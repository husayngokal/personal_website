/*
 * Add something to this week's plate: a quest or a curiosity, in one form.
 *
 *   POST { title, lane, hours, milestones?: string[], due?: 'YYYY-MM-DD', weeklyHours? }
 *
 * Creates tasks/<slug>.md scoped to this week with its points frozen in
 * its score block: gut hours doubled, split across the named milestones
 * (one button each, in order) or one piece if none. Its hours a week are
 * the pace its due date needs, or, with no due date, the hours a week you
 * say you will give it. Goes through the same weekly-hours check as every
 * other way onto the plate. Studio-only: the session's GitHub token commits.
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
import { authorDay } from '@/lib/content/streak';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await getStudioSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'no-database' }, { status: 503 });

  let body: { title?: string; lane?: string; hours?: number; milestones?: string[]; due?: string; weeklyHours?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'malformed-body' }, { status: 400 }); }

  const title = String(body.title ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (!title) return NextResponse.json({ error: 'bad-request', detail: 'It needs a name.' }, { status: 400 });
  const slug = slugify(title);
  if (!slug) return NextResponse.json({ error: 'bad-request', detail: 'That name has no letters or numbers.' }, { status: 400 });
  const path = `tasks/${slug}.md`;

  /* With a due date, its hours a week are the pace that date needs. With
     none, it has no deadline to work back from, so its hours a week are
     what you say you will give it. Either way that is what counts toward
     the weekly limit. */
  const today = authorDay();
  const due = /^\d{4}-\d{2}-\d{2}$/.test(String(body.due ?? '')) && String(body.due) >= today ? String(body.due) : null;
  const weekly = Number(body.weeklyHours);
  if (!due && !(Number.isFinite(weekly) && weekly > 0)) {
    return NextResponse.json({ error: 'bad-request', detail: 'Give it a due date, or the hours a week you will give it.' }, { status: 400 });
  }
  const names = (Array.isArray(body.milestones) ? body.milestones : [])
    .map((m) => String(m).replace(/[\r\n]+/g, ' ').trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 30);

  let raw: string;
  try {
    const base = buildFromTemplate('task', { hours: body.hours, count: 1, lane: body.lane }, 'tasks');
    const total = base.parts[0].points;
    /* Named milestones: one group each, the points split so they add up
       to exactly the total. */
    if (names.length > 1) {
      base.parts = names.map((name, i) => ({
        unit: 'milestone', name, count: 1, prior: 0, done: [],
        points: Math.round((total * (i + 1)) / names.length) - Math.round((total * i) / names.length),
      }));
    } else if (names.length === 1) {
      base.parts[0] = { ...base.parts[0], unit: 'milestone', name: names[0] };
    }
    if (!due) base.weeklyHours = Math.round(weekly * 10) / 10;
    const head = `---\ntitle: ${JSON.stringify(title)}\nstatus: open\nscope: this-week\n${due ? `due: ${due}\n` : ''}---\n\nAdded to the plate from Studio.\n`;
    raw = setScoreBlock(head, base);
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
