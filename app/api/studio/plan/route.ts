/*
 * Add something to this week's plate: a quest or a curiosity, in one form.
 *
 *   POST { title, lane, hours, count, weeklyHours }
 *
 * Creates tasks/<slug>.md scoped to this week with its points frozen in
 * its score block (the task template: gut hours doubled, spread across
 * `count` milestones), after the same weekly-hours check every other way
 * onto the plate goes through. Studio-only: the session's GitHub token
 * makes the commit.
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getStudioSession } from '@/lib/studio/session';
import { getFile, putFile } from '@/lib/studio/github';
import { slugify } from '@/lib/studio/markdown';
import { buildFromTemplate, setScoreBlock } from '@/lib/score/block';
import { overCapacity } from '@/lib/score/capacity';
import { readScore, recomputeScore } from '@/lib/score/store';
import { fetchVaultMarkdown } from '@/lib/vault/tarball';
import { parseFile } from '@/lib/vault/parse';
import { getServerAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { markActiveToday } from '@/lib/content/vault-state';
import { deriveAndWriteLiveState } from '@/lib/content/derive';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await getStudioSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'no-database' }, { status: 503 });

  let body: { title?: string; lane?: string; hours?: number; count?: number; weeklyHours?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'malformed-body' }, { status: 400 }); }

  const title = String(body.title ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (!title) return NextResponse.json({ error: 'bad-request', detail: 'It needs a name.' }, { status: 400 });
  const slug = slugify(title);
  if (!slug) return NextResponse.json({ error: 'bad-request', detail: 'That name has no letters or numbers.' }, { status: 400 });
  const path = `tasks/${slug}.md`;

  let raw: string;
  try {
    const block = buildFromTemplate('task', {
      hours: body.hours, count: body.count, lane: body.lane, weeklyHours: body.weeklyHours,
    }, 'tasks');
    const head = `---\ntitle: ${JSON.stringify(title)}\nstatus: open\nscope: this-week\n---\n\nAdded to the plate from Studio.\n`;
    raw = setScoreBlock(head, block);
    parseFile(path, raw);
  } catch (err) {
    return NextResponse.json({ error: 'bad-request', detail: (err as Error).message }, { status: 400 });
  }

  const db = getServerAdminClient();
  const over = overCapacity(await readScore(db), path, raw);
  if (over) return NextResponse.json({ error: 'over-capacity', ...over }, { status: 409 });

  if (await getFile(session.token, path)) {
    return NextResponse.json({ error: 'exists', detail: 'Something with that name already exists. Pull it into this week instead.' }, { status: 409 });
  }
  let commit: { commitSha: string; commitDate: string };
  try {
    commit = await putFile(session.token, { path, content: raw, message: `studio: this week, ${title}` });
  } catch (err) {
    return NextResponse.json({ error: 'commit-failed', detail: (err as Error).message }, { status: 502 });
  }

  after(async () => {
    try {
      await markActiveToday(db);
      await deriveAndWriteLiveState(db);
      await recomputeScore(db, await fetchVaultMarkdown(commit.commitSha || undefined), {
        override: { path, content: raw }, asOf: commit.commitDate || undefined,
      });
    } catch (err) {
      console.error(`[studio/plan] background work failed: ${(err as Error).message}`);
    }
    for (const p of ['/', '/life/tasks']) { try { revalidatePath(p); } catch { /* best effort */ } }
  });

  return NextResponse.json({ ok: true, path, slug, summary: `${title}: on the plate this week` });
}
