/*
 * Scored items -> the score state the site shows.
 *
 * Weeks run Monday to Sunday in the author's timezone (Asia/Dubai, see
 * lib/content/streak.ts). A week's score is its quest points plus its
 * curiosity points up to that week's cap; its bar, cap and plate limit
 * come from week-rule.ts. Outcomes never fill a week; they go to the
 * lifetime total and the level.
 *
 * Pure module, no I/O.
 */

import { authorDay, weekStart } from '../content/streak';
import {
  LEVEL_SIZE, PRACTICE_FROM, SCORE_EPOCH, type Lane, type Source,
} from './rules';
import { weekRules, type WeekRule } from './week-rule';
import { extraLeftMinutes, extraMinutes, laneOn, partsDone, planOf, practiceIn, repeatCount } from './block';
import { calibrate, varianceNotes, type Calibration, type VarianceNote } from './calibrate';
import { plural, type Extracted, type ScoreEvent, type ScoreItem, type Surface, type Tally } from './items';
import type { Session } from './time';

export interface WeekTotals {
  start: string;
  quest: number;
  curiosity: number;            // all curiosity earned
  curiosityCounted: number;     // the part that fills the bar
  bar: number;                  // the week's score toward its bar
  /** The week's own bar and curiosity cap (week-rule.ts). Absent on a
   *  score stored before the bar moved week to week: then 200 and 80. */
  max?: number;
  cap?: number;
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
  basis: Source | null;         // where its price came from
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
  parked: boolean;              // off the plate by its score block (an exam)
  weekMinutes: number;          // time logged against it this week
  hasBlock: boolean;            // carries its own frozen score block
  needsSetup: string | null;
  earned: number;               // points of finished parts (prior work included)
  total: number;                // points of all parts
  /** Minutes planned outside the parts, in all: practice hours, or every
   *  activity plan at its rate. */
  extra: number;
  /** Practice hours planned, and how many the logged activities cover. */
  practice: { hours: number; done: number; byHand: boolean; rule: number | null } | null;
  pct: number;                  // 0-100
  summary: string;              // "16 of 120 chapters"
  weekPoints: number;
  weeklyHours: number | null;
  paced: boolean;
  deadline: string | null;
  /** The date is one someone else fixed: it counts toward the bar's floor. */
  fixedDate?: boolean;
  outcome: { points: number; achieved: string | null } | null;
  /** Due its one content re-measure (block.ts). */
  remeasure: boolean;
  parts: ItemGroupView[];
  repeat: { index: number; unit: string; points: number; per: number | null; kind: string | null; count: number; plan: number }[];
}

export interface ScoreState {
  version: 1;
  /** Commit time (ISO, UTC) of the vault state this was computed from. */
  asOf?: string;
  today: string;
  epoch: string;
  bar: number;                  // this week's bar
  curiosityCap: number;         // this week's curiosity cap
  /** This week's rule, and next week's as it stands now. */
  rule?: WeekRule;
  next?: WeekRule;
  week: WeekTotals;
  history: WeekTotals[];        // oldest first, current week last
  streak: number;               // full weeks in a row
  lifetime: { points: number; outcomes: number; level: number; intoLevel: number; levelSize: number };
  items: ItemView[];            // the plate, plus anything that scored this week
  /** Every task already priced, off the plate or not, by slug: its points
   *  in all. So the backlog shows the real price, not a default. */
  priced?: Record<string, number>;
  surfaces: Record<Surface, { weekPoints: number }>;
  tallies: { tasks: Tally; atlas: Tally; list: Tally };
  load: { hours: number; capacity: number };
  recent: ScoreEvent[];         // newest first
  /** The factor each source of estimate is priced at now, the reviews
   *  that set them, and the next one (calibrate.ts). */
  calibration: Calibration;
  /** Finished parts that took under half or over double their price. */
  variance: VarianceNote[];
  /** Timed hours (a log; never points). */
  time: {
    weekMinutes: number;
    /** This week's minutes by lane: a scoring session's own lane, else its item's; "other" for time on nothing in particular. */
    weekByLane?: { quest: number; curiosity: number; other: number };
    byKey: Record<string, number>; totalByKey: Record<string, number>; recent: Session[];
  };
}

const SURFACES: Surface[] = ['tasks', 'library', 'courses', 'exams', 'projects', 'atlas', 'list', 'notebook', 'writeups', 'timer'];

function addDays(isoDay: string, n: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function lanesFor(events: ScoreEvent[]): { quest: number; curiosity: number } {
  let quest = 0, curiosity = 0;
  for (const e of events) {
    if (e.kind === 'outcome') continue;
    if (e.lane === 'quest') quest += e.points;
    else curiosity += e.points;
  }
  return { quest, curiosity };
}

function totalsFor(rule: WeekRule, events: ScoreEvent[]): WeekTotals {
  const { quest, curiosity } = lanesFor(events);
  const curiosityCounted = Math.min(curiosity, rule.cap);
  const bar = quest + curiosityCounted;
  return {
    start: rule.start, quest, curiosity, curiosityCounted, bar, max: rule.bar, cap: rule.cap,
    full: bar >= rule.bar, extra: Math.max(0, bar - rule.bar),
  };
}

function itemView(item: ScoreItem, weekPoints: number, weekMinutes: number, today: string): ItemView {
  const pr = practiceIn(item, undefined, today);
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
      prior: g.prior, logged: g.done.length, current, basis: g.basis ?? null,
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
    : rep ? `${repeatCount(rep)} ${repeatCount(rep) === 1 ? rep.unit : plural(rep.unit)} logged`
    : item.needsSetup ? 'not set up for scoring yet' : '';
  return {
    key: item.key, table: item.table, slug: item.slug, surface: item.surface,
    title: item.title, href: item.href, lane: item.lane, active: item.active,
    parked: item.parked, weekMinutes,
    hasBlock: item.hasBlock, needsSetup: item.needsSetup,
    earned, total, pct: total ? Math.round((earned / total) * 100) : 0, summary,
    extra: Math.round(extraMinutes(item, today)),
    practice: pr.hours > 0
      ? {
          hours: pr.hours, byHand: pr.byHand, rule: item.practiceRule && today >= PRACTICE_FROM ? item.practiceRule : null,
          done: Math.round(((pr.hours * 60 - extraLeftMinutes(item, undefined, today)) / 60) * 10) / 10,
        }
      : null,
    weekPoints, weeklyHours: item.weeklyHours, paced: item.paced, deadline: item.deadline, fixedDate: item.fixedDate && !item.unbooked, outcome: item.outcome,
    remeasure: item.remeasure,
    parts,
    repeat: item.repeat.map((g, index) => ({
      index, unit: g.unit, points: g.points, per: g.per ?? null, kind: g.kind ?? null, count: repeatCount(g), plan: planOf(g),
    })),
  };
}

export function computeScore(extracted: Extracted, today: string = authorDay()): ScoreState {
  const { items, tallies, sessions } = extracted;
  const thisWeek = weekStart(today);

  /* Timed sessions that score (frozen points in their log line) are
     events too, on the item they were timed against or on their own. */
  const byPath = new Map(items.map((i) => [i.key, i]));
  const timedEvents: ScoreEvent[] = sessions
    .filter((x) => x.scores && x.scores.points > 0)
    .map((x) => {
      const it = x.key ? byPath.get(x.key) : undefined;
      return {
        date: x.date, points: x.scores!.points, lane: x.scores!.lane, kind: 'repeat' as const,
        key: it?.key ?? `time:${x.label}`, surface: it?.surface ?? 'timer',
        label: `${it?.title ?? x.label} · timed ${x.minutes} min`,
      };
    });

  /* Everything that counts: on or after the epoch, not in the future. */
  const events = [...items.flatMap((i) => i.events), ...timedEvents]
    .filter((e) => e.date >= SCORE_EPOCH && e.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.points - a.points);

  const byWeek = new Map<string, ScoreEvent[]>();
  for (const e of events) {
    const w = weekStart(e.date);
    (byWeek.get(w) ?? byWeek.set(w, []).get(w)!).push(e);
  }

  /* Every week's bar, cap and plate limit, from the first week shown to
     next week (as it stands now). */
  const firstShown = addDays(thisWeek, -7 * 11);
  const epochWeek = weekStart(SCORE_EPOCH);
  const rules = weekRules(items, firstShown < epochWeek ? firstShown : epochWeek, addDays(thisWeek, 7), (start, cap) => {
    const l = lanesFor(byWeek.get(start) ?? []);
    return l.quest + Math.min(l.curiosity, cap);
  });
  const ruleOf = new Map(rules.map((r) => [r.start, r]));
  /* The plate's limit is set by hand (now/plate.md) and in force at once,
     this week and next; past weeks keep the figure they were shown with. */
  if (extracted.plateHours) {
    for (const w of [thisWeek, addDays(thisWeek, 7)]) ruleOf.set(w, { ...ruleOf.get(w)!, limitHours: extracted.plateHours });
  }
  const rule = ruleOf.get(thisWeek)!;
  const next = ruleOf.get(addDays(thisWeek, 7))!;

  const history: WeekTotals[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    history.push(totalsFor(ruleOf.get(start)!, byWeek.get(start) ?? []));
  }
  const week = history[history.length - 1];

  /* Full weeks in a row, each against its own bar. An unfinished current
     week does not break the run; it only extends it once the bar is full. */
  let streak = 0;
  let cursor = week.full ? thisWeek : addDays(thisWeek, -7);
  while (cursor >= epochWeek) {
    if (!totalsFor(ruleOf.get(cursor)!, byWeek.get(cursor) ?? []).full) break;
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

  /* Time this week, per item and in all. */
  const weekSessions = sessions.filter((x) => weekStart(x.date) === thisWeek && x.date <= today);
  const byKey: Record<string, number> = {};
  for (const x of weekSessions) if (x.key) byKey[x.key] = (byKey[x.key] ?? 0) + x.minutes;
  const weekMinutes = weekSessions.reduce((n, x) => n + x.minutes, 0);
  const weekByLane = { quest: 0, curiosity: 0, other: 0 };
  for (const x of weekSessions) {
    const it = x.key ? byPath.get(x.key) : undefined;
    /* Outings score as quests, but the time is curiosity time. */
    const lane = it?.surface === 'atlas' ? 'curiosity' : it ? laneOn(it.lane, it.laneWas, x.date) : undefined;
    weekByLane[x.scores?.lane ?? lane ?? 'other'] += x.minutes;
  }
  /* All-time minutes per item on record-only sessions (time spent on the
     work the item's own buttons score): work timed before something is
     priced sets it up at half rate. */
  const totalByKey: Record<string, number> = {};
  for (const x of sessions) if (x.key && !x.scores) totalByKey[x.key] = (totalByKey[x.key] ?? 0) + x.minutes;
  const recentSessions = [...sessions]
    .sort((a, b) => `${b.date} ${b.to}`.localeCompare(`${a.date} ${a.to}`))
    .slice(0, 12);

  const views = items
    .filter((i) => i.active || i.parked || weekByItem.has(i.key))
    .map((i) => itemView(i, weekByItem.get(i.key) ?? 0, byKey[i.key] ?? 0, today))
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
    bar: rule.bar,
    curiosityCap: rule.cap,
    rule,
    next,
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
    priced: Object.fromEntries(items
      .filter((i) => i.table === 'tasks' && i.hasBlock)
      .map((i) => [i.slug, i.parts.reduce((n, g) => n + g.points, 0) || i.repeat.reduce((n, g) => n + g.points, 0)])),
    surfaces,
    tallies,
    load: { hours: Math.round(load * 10) / 10, capacity: rule.limitHours },
    recent: events.slice(0, 15),
    time: { weekMinutes, weekByLane, byKey, totalByKey, recent: recentSessions },
    calibration: calibrate(items, sessions, today),
    variance: varianceNotes(items, sessions, today),
  };
}
