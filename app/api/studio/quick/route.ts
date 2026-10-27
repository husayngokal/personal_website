/*
 * Studio one-tap updates — POST a QuickRequest (see lib/studio/quick.ts).
 *
 *   { target: 'book', slug, action: 'bump', by: 10 }
 *   { target: 'task', slug, action: 'done' }
 *   { target: 'project', slug, action: 'set-active', on: true }
 *   { target: 'atlas', slug: 'field-atlas', action: 'done', line }
 *
 * Flow: resolve the vault path, read the file from GitHub, compute the
 * edit from the file's CURRENT content, commit it as the signed-in author
 * (sha-guarded, one retry if the file moved underneath us), then patch the
 * Postgres row directly so the site reflects the tap at once instead of
 * after the ~30s webhook sync. The vault commit is the source of truth:
 * the write-through is best effort and the sync that follows the commit
 * overwrites it with the same values either way.
 *
 * `dryRun: true` runs everything except the commit and the DB write and
 * returns the would-be file, for testing against production data safely.
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getStudioSession } from '@/lib/studio/session';
import { deleteFile, getFile, putFile } from '@/lib/studio/github';
import { applyQuick, QuickError, specFor, type QuickRequest, type QuickResult } from '@/lib/studio/quick';
import { fetchVaultMarkdown } from '@/lib/vault/tarball';
import { readScore, recomputeScore } from '@/lib/score/store';
import { overCapacity } from '@/lib/score/capacity';
import { getServerAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { getVaultPath, markActiveToday } from '@/lib/content/vault-state';
import { deriveAndWriteLiveState } from '@/lib/content/derive';
import { authorDay } from '@/lib/content/streak';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const REVALIDATE: Record<string, string[]> = {
  book: ['/', '/library', '/library/[slug]'],
  task: ['/', '/life/tasks'],
  project: ['/', '/projects', '/projects/[slug]'],
  atlas: ['/', '/field-atlas'],
  score: ['/', '/life/tasks', '/library', '/library/[slug]', '/courses', '/courses/[slug]', '/study/credentials/[slug]', '/projects'],
};

export async function POST(req: NextRequest) {
  const session = await getStudioSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: QuickRequest & { dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'malformed-body' }, { status: 400 });
  }
  const spec = body && typeof body === 'object' ? specFor(body as { target: QuickRequest['target']; table?: string }) : null;
  if (!spec || typeof body.slug !== 'string' || !/^[\w.-]{1,200}$/.test(body.slug)) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'no-database' }, { status: 503 });
  const db = getServerAdminClient();

  /* Where the file lives. The sync's index is authoritative (task slugs
     come from frontmatter, not filenames); flat folders can be guessed. */
  const path =
    (await getVaultPath(db, spec.table, body.slug)) ??
    (spec.folder ? `${spec.folder}/${body.slug}.md` : null);
  if (!path) return NextResponse.json({ error: 'path-unknown', detail: 'No vault path on record for this entry yet. It appears after the next sync.' }, { status: 404 });

  /* Deleting a task outright (a mistake, or something that should never
     have been added): tasks only, removes the vault file. Everything else
     comes off the plate instead and keeps its history. */
  if (body.target === 'score' && body.action === 'delete') {
    if (spec.table !== 'tasks') return NextResponse.json({ error: 'bad-request', detail: 'Only a task can be deleted here.' }, { status: 400 });
    const file = await getFile(session.token, path);
    if (!file) return NextResponse.json({ error: 'not-found', path }, { status: 404 });
    try {
      await deleteFile(session.token, { path, sha: file.sha, message: `studio: delete ${path}` });
    } catch (err) {
      return NextResponse.json({ error: 'commit-failed', detail: (err as Error).message }, { status: 502 });
    }
    after(async () => {
      try {
        await db.from('tasks').delete().eq('slug', body.slug);
        await deriveAndWriteLiveState(db);
        const files = (await fetchVaultMarkdown()).filter((f) => f.path !== path);
        await recomputeScore(db, files, { asOf: new Date().toISOString() });
      } catch (err) {
        console.error(`[studio/quick] delete follow-up failed: ${(err as Error).message}`);
      }
      for (const p of ['/', '/life/tasks']) { try { revalidatePath(p); } catch { /* best effort */ } }
    });
    return NextResponse.json({ ok: true, path, row: {}, summary: 'Deleted.', undo: null, deleted: true });
  }

  const today = authorDay();
  const cached = await readScore(db);
  let result: QuickResult | null = null;
  let commit = { commitSha: '', commitDate: '' };
  try {
    /* Two attempts: if the file changed between our read and our write
       (a sync cannot do that, but Obsidian on another device can), read
       it again and recompute rather than fail the tap. */
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const file = await getFile(session.token, path);
      if (!file) return NextResponse.json({ error: 'not-found', path }, { status: 404 });
      const computed = applyQuick(body, path, file.content, today, {
        timedMinutes: cached?.time?.totalByKey?.[path],
        calibration: cached?.calibration?.factor,
      });

      /* The weekly limit. Anything that would push the active load past
         the week is refused before it is committed, with the plate
         attached so the page can offer a swap. */
      const over = overCapacity(cached, path, computed.raw);
      if (over) return NextResponse.json({ error: 'over-capacity', ...over }, { status: 409 });

      if (body.dryRun || !computed.changed) {
        return NextResponse.json({
          ok: true, dryRun: Boolean(body.dryRun), unchanged: !computed.changed, path,
          row: computed.row, summary: computed.summary, undo: computed.undo, line: computed.line,
          ...(body.dryRun ? { content: computed.raw } : {}),
        });
      }
      try {
        commit = await putFile(session.token, { path, content: computed.raw, sha: file.sha, message: `studio: ${computed.summary}` });
        result = computed;
      } catch (err) {
        const msg = (err as Error).message;
        if (attempt === 0 && (msg.includes('putFile 409') || msg.includes('putFile 422'))) continue;
        throw err;
      }
    }
  } catch (err) {
    if (err instanceof QuickError) {
      const status = err.code === 'bad-request' ? 400 : err.code === 'stale' ? 409 : 422;
      return NextResponse.json({ error: err.code, detail: err.message }, { status });
    }
    return NextResponse.json({ error: 'commit-failed', detail: (err as Error).message }, { status: 502 });
  }
  if (!result) return NextResponse.json({ error: 'conflict', detail: 'The file kept changing. Reload and try again.' }, { status: 409 });

  /* Answer now; the page has already shown the points. Everything else
     (the row write-through, live state, the full score recompute from the
     vault with this file laid over it, the cache) runs after the response.
     The new score reaches every open page over Realtime when it lands. */
  const done = result;
  after(async () => {
    try {
      if (Object.keys(done.row).length) await db.from(spec.table).update(done.row).eq('slug', body.slug);
      await markActiveToday(db);
      await deriveAndWriteLiveState(db);
    } catch (err) {
      console.error(`[studio/quick] write-through failed for ${path}: ${(err as Error).message}`);
    }
    try {
      /* Read the vault at exactly this commit (never a cached older copy),
         and stamp the result with its time so an earlier tap's recompute
         finishing later cannot overwrite it. */
      await recomputeScore(db, await fetchVaultMarkdown(commit.commitSha || undefined), {
        override: { path, content: done.raw },
        asOf: commit.commitDate || undefined,
      });
    } catch (err) {
      console.error(`[studio/quick] score recompute failed: ${(err as Error).message}`);
    }
    for (const p of REVALIDATE[body.target] ?? []) {
      try { revalidatePath(p, p.includes('[') ? 'page' : undefined); } catch { /* best effort */ }
    }
  });

  return NextResponse.json({
    ok: true, path, row: result.row, summary: result.summary, undo: result.undo, line: result.line,
  });
}
