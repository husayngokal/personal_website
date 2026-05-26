/*
 * Live-state derivation — queries Postgres, applies "what counts as
 * currently X" rules, and writes the result to the current_state
 * table so Realtime broadcasts to homepage subscribers.
 *
 * Resilience rule: each key tries primary signal → secondary → tertiary
 * before giving up. The typewriter on the homepage depends on at least
 * one of these returning a value; if every one is empty the fallback
 * phrase "currently here, writing this." takes over, which reads as
 * the site being asleep. Better to surface a slightly older signal
 * than to look dead.
 *
 * Keys:
 *   currently_reading  — library_books with status in (reading, re-reading)
 *                        - primary: highest progress_pct (when set)
 *                        - fallback: most recently updated reading book
 *                        Progress is now optional in the phrase; a book
 *                        with no progress_pct renders as "currently
 *                        reading X" without a percentage.
 *
 *   currently_building — primary: projects.status=active, most recent
 *                        - fallback: top priority in-progress task
 *                        - fallback: most recently updated in-progress task
 *
 *   currently_writing  — primary: notebook_posts updated in the last 7 days
 *                        - fallback: updated in the last 30 days
 *                        - fallback: most recently published notebook_post
 *
 *   currently_studying — the next pending study_credential with an
 *                        exam_date. Two registers: "studying" while the
 *                        exam is ahead, "awaiting results" once it's
 *                        sat but the credential is still marked pending.
 *                        Multiple pending rows resolve to the soonest
 *                        upcoming exam; if none are upcoming, the most
 *                        recent past pending exam drives awaiting-results.
 *                        - fallback: courses.status=studying, most recent
 *
 *   currently_exploring — separate slot, sourced from ideas. The newest
 *                         open / exploring / building idea wins. Distinct
 *                         from "studying" because they're different
 *                         registers — studying is a syllabus, exploring
 *                         is an open question.
 *
 *   currently_listening — owned by the Spotify poller, not touched here.
 *
 * Called by:
 *   - scripts/seed.ts                (initial population)
 *   - lib/vault/sync.ts              (after every content upsert)
 *   - app/api/derive/route.ts        (manual re-derive trigger; doesn't
 *     exist yet, but the function is exported for a future endpoint)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const SEVEN_DAYS_MS  = 7  * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface DeriveResult {
  written: Record<string, object | null>;
}

export async function deriveAndWriteLiveState(db: SupabaseClient): Promise<DeriveResult> {
  const result: DeriveResult = { written: {} };

  /* -- Reading ------------------------------------------------------ */
  let readingValue: Record<string, unknown> = {};

  /* Primary: books with explicit progress, ranked by it. */
  const { data: readingByProgress } = await db
    .from('library_books')
    .select('slug, title, author, progress_pct, cover_url, updated_at')
    .in('status', ['reading', 're-reading'])
    .not('progress_pct', 'is', null)
    .order('progress_pct', { ascending: false })
    .limit(1);

  let reading = readingByProgress?.[0];

  /* Fallback: any reading book, most recently updated. */
  if (!reading) {
    const { data: readingAny } = await db
      .from('library_books')
      .select('slug, title, author, progress_pct, cover_url, updated_at')
      .in('status', ['reading', 're-reading'])
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1);
    reading = readingAny?.[0];
  }

  if (reading) {
    readingValue = {
      slug: reading.slug,
      title: reading.title,
      author: reading.author,
      progressPct: reading.progress_pct ?? null,
      coverUrl: reading.cover_url ?? null,
    };
  }
  await writeKey(db, 'currently_reading', readingValue);
  result.written['currently_reading'] = reading ? readingValue : null;

  /* -- Building ----------------------------------------------------- */
  let buildingValue: Record<string, unknown> = {};

  /* Primary: an active project, most recently touched. */
  const { data: projectRows } = await db
    .from('projects')
    .select('slug, title, last_active, last_edited_at, repo_private')
    .eq('status', 'active')
    .order('last_edited_at', { ascending: false, nullsFirst: false })
    .order('last_active', { ascending: false })
    .limit(1);

  if (projectRows?.[0]) {
    const p = projectRows[0];
    buildingValue = {
      slug: p.slug,
      title: p.title,
      branch: 'main',
      lastActiveDate: p.last_edited_at ?? p.last_active,
      private: p.repo_private,
    };
  } else {
    /* Fallback: top-priority in-progress task. */
    const { data: taskRows } = await db
      .from('tasks')
      .select('slug, title, status, priority, last_edited_at')
      .eq('status', 'in-progress')
      .order('priority', { ascending: true, nullsFirst: false })
      .order('last_edited_at', { ascending: false, nullsFirst: false })
      .limit(1);
    let task = taskRows?.[0];

    /* Further fallback: any open task, most recently touched. The point
       is to never report a dead build when there's clearly real work
       happening on the tasks surface. */
    if (!task) {
      const { data: openTaskRows } = await db
        .from('tasks')
        .select('slug, title, status, priority, last_edited_at')
        .eq('status', 'open')
        .order('last_edited_at', { ascending: false, nullsFirst: false })
        .limit(1);
      task = openTaskRows?.[0];
    }

    if (task) {
      buildingValue = {
        slug: task.slug,
        title: task.title,
        branch: 'main',
        lastActiveDate: task.last_edited_at ?? new Date().toISOString(),
        private: false,
      };
    }
  }
  await writeKey(db, 'currently_building', buildingValue);
  result.written['currently_building'] = Object.keys(buildingValue).length ? buildingValue : null;

  /* -- Writing ------------------------------------------------------ */
  let writingValue: Record<string, unknown> = {};

  /* Primary: posts updated in the last 7 days. */
  const cutoff7  = new Date(Date.now() - SEVEN_DAYS_MS).toISOString().slice(0, 10);
  const cutoff30 = new Date(Date.now() - THIRTY_DAYS_MS).toISOString().slice(0, 10);

  const tryWindow = async (cutoff: string) => {
    const { data } = await db
      .from('notebook_posts')
      .select('slug, title, word_count, updated, date')
      .not('updated', 'is', null)
      .gte('updated', cutoff)
      .order('word_count', { ascending: false, nullsFirst: false })
      .limit(1);
    return data?.[0];
  };

  let writing = await tryWindow(cutoff7);
  if (!writing) writing = await tryWindow(cutoff30);

  /* Final fallback: the most-recently-published post regardless of date.
     The phrase becomes "currently writing about X" which technically
     stretches the truth, but the alternative is the typewriter going
     blank, which reads worse. */
  if (!writing) {
    const { data } = await db
      .from('notebook_posts')
      .select('slug, title, word_count, updated, date')
      .order('date', { ascending: false, nullsFirst: false })
      .limit(1);
    writing = data?.[0];
  }

  if (writing) {
    writingValue = {
      slug: writing.slug,
      title: writing.title,
      wordCount: writing.word_count ?? 0,
    };
  }
  await writeKey(db, 'currently_writing', writingValue);
  result.written['currently_writing'] = writing ? writingValue : null;

  /* -- Studying — concrete things with a date or a syllabus -------- */
  let studyingValue: Record<string, unknown> = {};

  /* Pull every pending credential with an exam date, in ascending order
     so the next upcoming exam comes first. The two registers — "studying"
     for an exam still ahead, "awaiting results" for one that's sat but
     not yet earned — both come from the same set: if any pending row's
     exam is still in the future, that one wins ("currently studying for
     the next thing"); otherwise the most recent past pending row drives
     the awaiting-results phrase. */
  const { data: credRows } = await db
    .from('study_credentials')
    .select('slug, title, exam_date')
    .eq('pending', true)
    .not('exam_date', 'is', null)
    .order('exam_date', { ascending: true });

  const today = new Date().toISOString().slice(0, 10);
  const pending = (credRows ?? []) as { slug: string; title: string; exam_date: string }[];
  const upcoming = pending.find((c) => c.exam_date >= today);
  const cred = upcoming ?? [...pending].reverse().find((c) => c.exam_date < today);

  if (cred) {
    const awaiting = cred.exam_date < today;
    studyingValue = awaiting
      ? { slug: cred.slug, title: cred.title, examDate: cred.exam_date, awaitingResults: true }
      : { slug: cred.slug, title: cred.title, examDate: cred.exam_date };
  } else {
    /* Fallback: a currently-studying course, most recently touched.
       No idea fallback here; ideas have their own slot below. */
    const { data: courseRows } = await db
      .from('courses')
      .select('slug, title, status, last_edited_at')
      .eq('status', 'studying')
      .order('last_edited_at', { ascending: false, nullsFirst: false })
      .limit(1);
    if (courseRows?.[0]) {
      const c = courseRows[0];
      studyingValue = { slug: c.slug, title: c.title, examDate: '' };
    }
  }
  await writeKey(db, 'currently_studying', studyingValue);
  result.written['currently_studying'] = Object.keys(studyingValue).length ? studyingValue : null;

  /* -- Exploring — open questions, ideas, things I'm spinning on --- */
  let exploringValue: Record<string, unknown> = {};
  const { data: ideaRows } = await db
    .from('ideas')
    .select('slug, title, status, proposed')
    .in('status', ['open', 'exploring', 'building'])
    .order('proposed', { ascending: false })
    .limit(1);
  if (ideaRows?.[0]) {
    const i = ideaRows[0];
    exploringValue = { slug: i.slug, title: i.title };
  }
  await writeKey(db, 'currently_exploring', exploringValue);
  result.written['currently_exploring'] = Object.keys(exploringValue).length ? exploringValue : null;

  return result;
}

async function writeKey(db: SupabaseClient, key: string, value: object) {
  const { error } = await db
    .from('current_state')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
  if (error) throw new Error(`current_state[${key}] upsert failed: ${error.message}`);
}
