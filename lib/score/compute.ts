/*
 * Scored items -> the score state the site shows.
 *
 * Weeks run Monday to Sunday in the author's timezone (Asia/Dubai, see
 * lib/content/streak.ts). A week's bar is its quest points plus its
 * curiosity points up to the cap. Outcomes never fill a week; they go to
 * the lifetime total and the level.
 *
 * Pure module, no I/O.
 */

import { authorDay, weekStart } from '../content/streak';
import {
  CURIOSITY_CAP, LEVEL_SIZE, SCORE_EPOCH, WEEKLY_BAR, WEEKLY_HOURS, type Lane,
} from './rules';
import { partsDone } from './block';
import { plural, type Extracted, type ScoreEvent, type ScoreItem, type Surface, type Tally } from './items';

export interface WeekTotals {
  start: string;
  quest: number;
  curiosity: number;            // all curiosity earned
  curiosityCounted: number;     // the part that fills the bar
  bar: number;
  full: boolean;
  extra: number;
}

export interface ItemGroupView {
  index: number;
  unit: string;
  name: string | null;
  done: number;
  count: number;
  points: number;
  prior: number;                // finished before tracking (no points)
  logged: number;               // entries logged since tracking (count is frozen once > 0)
  current: boolean;             // the first unfinished group of its unit
}

export interface ItemView {
  key: string;
  table: string;
  slug: string;
  surface: Surface;
  title: string;
  href: string | null;
  lane: Lane;
  active: boolean;
  needsSetup: string | null;
  earned: number;               // points of finished parts (prior work included)
  total: number;                // points of all parts
  pct: number;                  // 0-100
  summary: string;              // "16 of 120 chapters"
  weekPoints: number;
  weeklyHours: number | null;
  deadline: string | null;
  outcome: { points: number; achieved: string | null } | null;
  parts: ItemGroupView[];
  repeat: { index: number; unit: string; points: number; count: number }[];
}

export interface ScoreState {
  version: 1;
  today: string;
  epoch: string;
  bar: number;
  curiosityCap: number;
  week: WeekTotals;
  history: WeekTotals[];        // oldest first, current week last
  streak: number;               // full weeks in a row
  lifetime: { points: number; outcomes: number; level: number; intoLevel: number; levelSize: number };
  items: ItemView[];            // the plate, plus anything that scored this week
  surfaces: Record<Surface, { weekPoints: number }>;
  tallies: { tasks: Tally; atlas: Tally; list: Tally };
  load: { hours: number; capacity: number };
  recent: ScoreEvent[];         // newest first
}

const SURFACES: Surface[] = ['tasks', 'library', 'courses', 'exams', 'projects', 'atlas', 'list', 'notebook', 'writeups'];

function addDays(isoDay: string, n: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function totalsFor(start: string, events: ScoreEvent[]): WeekTotals {
  let quest = 0, curiosity = 0;
  for (const e of events) {
    if (e.kind === 'outcome') continue;
    if (e.lane === 'quest') quest += e.points;
    else curiosity += e.points;
  }
  const curiosityCounted = Math.min(curiosity, CURIOSITY_CAP);
  const bar = quest + curiosityCounted;
  return {
    start, quest, curiosity, curiosityCounted, bar,
    full: bar >= WEEKLY_BAR, extra: Math.max(0, bar - WEEKLY_BAR),
  };
}

function itemView(item: ScoreItem, weekPoints: number): ItemView {
  let earned = 0, total = 0;
  const seen = new Set<string>();
  const parts: ItemGroupView[] = item.parts.map((g, index) => {
    const done = partsDone(g);
    earned += Math.round((g.points * done) / g.count);
    total += g.points;
    const current = done < g.count && !seen.has(g.unit);
    if (current) seen.add(g.unit);
    return {
      index, unit: g.unit, name: g.name ?? null, done, count: g.count, points: g.points,
      prior: g.prior, logged: g.done.length, current,
    };
  });
  /* Summarise the item by its first unit, across every group of that unit
     (all the chapters of all the books), naming the group in progress. */
  const unit = parts[0]?.unit;
  const same = parts.filter((g) => g.unit === unit);
  const doneSum = same.reduce((n, g) => n + g.done, 0);
  const countSum = same.reduce((n, g) => n + g.count, 0);
  const now = same.length > 1 ? same.find((g) => g.current) : undefined;
  const rep = item.repeat[0];
  const summary = unit
    ? `${doneSum} of ${countSum} ${countSum === 1 ? unit : plural(unit)}${now?.name ? ` · now ${now.name}` : ''}`
    : rep ? `${rep.done.length} ${rep.done.length === 1 ? rep.unit : plural(rep.unit)} logged`
    : item.needsSetup ? 'not set up for scoring yet' : '';
  return {
    key: item.key, table: item.table, slug: item.slug, surface: item.surface,
    title: item.title, href: item.href, lane: item.lane, active: item.active,
    needsSetup: item.needsSetup,
    earned, total, pct: total ? Math.round((earned / total) * 100) : 0, summary,
    weekPoints, weeklyHours: item.weeklyHours, deadline: item.deadline, outcome: item.outcome,
    parts,
    repeat: item.repeat.map((g, index) => ({ index, unit: g.unit, points: g.points, count: g.done.length })),
  };
}

export function computeScore(extracted: Extracted, today: string = authorDay()): ScoreState {
  const { items, tallies } = extracted;
  const thisWeek = weekStart(today);

  /* Everything that counts: on or after the epoch, not in the future. */
  const events = items
    .flatMap((i) => i.events)
    .filter((e) => e.date >= SCORE_EPOCH && e.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.points - a.points);

  const byWeek = new Map<string, ScoreEvent[]>();
  for (const e of events) {
    const w = weekStart(e.date);
    (byWeek.get(w) ?? byWeek.set(w, []).get(w)!).push(e);
  }

  const history: WeekTotals[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    history.push(totalsFor(start, byWeek.get(start) ?? []));
  }
  const week = history[history.length - 1];

  /* Full weeks in a row. An unfinished current week does not break the
     run; it only extends it once the bar is full. */
  let streak = 0;
  let cursor = week.full ? thisWeek : addDays(thisWeek, -7);
  while (cursor >= weekStart(SCORE_EPOCH)) {
    if (!totalsFor(cursor, byWeek.get(cursor) ?? []).full) break;
    streak++;
    cursor = addDays(cursor, -7);
  }

  const lifetimePoints = events.reduce((s, e) => s + e.points, 0);
  const outcomes = events.filter((e) => e.kind === 'outcome').reduce((s, e) => s + e.points, 0);

  const weekEvents = byWeek.get(thisWeek) ?? [];
  const weekByItem = new Map<string, number>();
  const surfaces = Object.fromEntries(SURFACES.map((s) => [s, { weekPoints: 0 }])) as ScoreState['surfaces'];
  for (const e of weekEvents) {
    if (e.kind === 'outcome') continue;
    weekByItem.set(e.key, (weekByItem.get(e.key) ?? 0) + e.points);
    surfaces[e.surface].weekPoints += e.points;
  }

  const views = items
    .filter((i) => i.active || weekByItem.has(i.key))
    .map((i) => itemView(i, weekByItem.get(i.key) ?? 0))
    .sort((a, b) =>
      Number(b.active) - Number(a.active) ||
      (a.lane === b.lane ? 0 : a.lane === 'quest' ? -1 : 1) ||
      (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') ||
      a.title.localeCompare(b.title));

  const load = items
    .filter((i) => i.active && i.weeklyHours)
    .reduce((s, i) => s + (i.weeklyHours ?? 0), 0);

  return {
    version: 1,
    today,
    epoch: SCORE_EPOCH,
    bar: WEEKLY_BAR,
    curiosityCap: CURIOSITY_CAP,
    week,
    history,
    streak,
    lifetime: {
      points: lifetimePoints,
      outcomes,
      level: Math.floor(lifetimePoints / LEVEL_SIZE) + 1,
      intoLevel: lifetimePoints % LEVEL_SIZE,
      levelSize: LEVEL_SIZE,
    },
    items: views,
    surfaces,
    tallies,
    load: { hours: load, capacity: WEEKLY_HOURS },
    recent: events.slice(0, 15),
  };
}
