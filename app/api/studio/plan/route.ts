/*
 * Add something to this week's plate: a quest or a curiosity, in one form.
 *
 *   POST { title, lane, hours, milestones?: string[], due?: 'YYYY-MM-DD', weeklyHours? }
 *
 * Creates tasks/<slug>.md scoped to this week with its points frozen in
 * its score block: gut hours times the guess factor in force, shared
 * across the named milestones (one button each, in order), each cut into
 * pieces if it would pass the 8-point cap for a guess, or equal pieces if
 * none are named. Its hours a week are
 * the pace its due date needs, or, with no due date, the hours a week you
 * say you will give it. Goes through the same weekly-hours check as every
 * other way onto the plate. Studio-only: the session's GitHub token commits.
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getStudioSession } from '@/lib/studio/session';
import { getFile, putFile } from '@/lib/studio/github';
import { slugify } from '@/lib/studio/markdown';
import { guessedParts, setScoreBlock, type ScoreBlock } from '@/lib/score/block';
import { factorsInForce } from '@/lib/score/calibrate';
import { DEFAULT_LANE, estimate, factorLabel } from '@/lib/score/rules';
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

  let body: { title?: string; lane?: string; hours?: number; milestones?: string[]; due?: string; weeklyHours?: number; place?: 'plate' | 'backlog' };
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
  const backlog = body.place === 'backlog';
  const due = !backlog && /^\d{4}-\d{2}-\d{2}$/.test(String(body.due ?? '')) && String(body.due) >= today ? String(body.due) : null;
  const weekly = Number(body.weeklyHours);
  if (!backlog && !due && !(Number.isFinite(weekly) && weekly > 0)) {
    return NextResponse.json({ error: 'bad-request', detail: 'Give it a due date, or the hours a week you will give it.' }, { status: 400 });
  }
  const names = (Array.isArray(body.milestones) ? body.milestones : [])
    .map((m) => String(m).replace(/[\r\n]+/g, ' ').trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 30);

  const db = getServerAdminClient();
  const cached = await readScore(db);

  let raw: string;
  try {
    const hours = Number(body.hours);
    if (!Number.isFinite(hours) || hours <= 0) throw new Error('Hours must be a positive number');
    const gut = factorsInForce(cached).gut;
    const total = estimate.gut(hours, gut);
    /* Named milestones share the total so it adds up exactly; any that
       would pass the cap for a guess is cut into equal pieces. */
    const base: ScoreBlock = {
      lane: body.lane === 'curiosity' || body.lane === 'quest' ? body.lane : DEFAULT_LANE.tasks,
      template: 'task',
      parts: guessedParts(total, names, gut, `${Math.round(hours * 100) / 100} hours, guessed, x ${factorLabel(gut)}`),
      repeat: [],
    };
    /* The backlog: no hours committed, nothing on the plate, points frozen
       now so they are known when it is brought on. */
    if (!backlog && !due) base.weeklyHours = Math.round(weekly * 10) / 10;
    const head = backlog
      ? `---\ntitle: ${JSON.stringify(title)}\nstatus: open\nscope: lifetime\ncategory: backlog\n---\n\nAdded to the backlog from Studio.\n`
      : `---\ntitle: ${JSON.stringify(title)}\nstatus: open\nscope: this-week\n${due ? `due: ${due}\n` : ''}---\n\nAdded to the plate from Studio.\n`;
    raw = setScoreBlock(head, base);
    parseFile(path, raw);
  } catch (err) {
    return NextResponse.json({ error: 'bad-request', detail: (err as Error).message }, { status: 400 });
  }

  const over = overCapacity(cached, path, raw);
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

  return NextResponse.json({ ok: true, path, slug, summary: backlog ? `${title}: in the backlog` : `${title}: on the plate this week` });
}
