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

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getStudioSession } from '@/lib/studio/session';
import { getFile, putFile } from '@/lib/studio/github';
import { applyQuick, QuickError, QUICK_TARGETS, type QuickRequest, type QuickResult } from '@/lib/studio/quick';
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
  atlas: ['/field-atlas'],
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
  const spec = QUICK_TARGETS[body?.target];
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

  const today = authorDay();
  let result: QuickResult | null = null;
  try {
    /* Two attempts: if the file changed between our read and our write
       (a sync cannot do that, but Obsidian on another device can), read
       it again and recompute rather than fail the tap. */
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const file = await getFile(session.token, path);
      if (!file) return NextResponse.json({ error: 'not-found', path }, { status: 404 });
      const computed = applyQuick(body, path, file.content, today);
      if (body.dryRun || !computed.changed) {
        return NextResponse.json({
          ok: true, dryRun: Boolean(body.dryRun), unchanged: !computed.changed, path,
          row: computed.row, summary: computed.summary, undo: computed.undo, line: computed.line,
          ...(body.dryRun ? { content: computed.raw } : {}),
        });
      }
      try {
        await putFile(session.token, { path, content: computed.raw, sha: file.sha, message: `studio: ${computed.summary}` });
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

  /* Write-through. Committed already, so nothing below may fail the tap. */
  try {
    await db.from(spec.table).update(result.row).eq('slug', body.slug);
    await markActiveToday(db);
    await deriveAndWriteLiveState(db);
    for (const p of REVALIDATE[body.target] ?? []) {
      revalidatePath(p, p.includes('[') ? 'page' : undefined);
    }
  } catch (err) {
    console.error(`[studio/quick] write-through failed for ${path}: ${(err as Error).message}`);
  }

  return NextResponse.json({
    ok: true, path, row: result.row, summary: result.summary, undo: result.undo, line: result.line,
  });
}
