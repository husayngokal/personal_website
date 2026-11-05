/*
 * The weekly bar, worked out week by week from the vault (rules.ts, BAR).
 *
 * Each week's numbers depend only on what happened before it started:
 * last week's bar and what it counted, and what the fixed-date items had
 * left at the start of the week. So taking things on and off the plate
 * midweek changes none of them, and every recompute (a sync, a Studio
 * tap, the midnight refresh) lands on the same numbers.
 *
 * Pure module, no I/O.
 */

import { extraLeftMinutes, parseDone } from './block';
import type { ScoreItem } from './items';
import { BAR, BOOKED_FROM, CURIOSITY_CAP, RATIO_FROM, MINUTES_PER_POINT, WEEKLY_BAR } from './rules';

export interface WeekRule {
  start: string;        // Monday
  bar: number;          // points that make the week full
  floor: number;        // what fixed-date work needed that week
  cap: number;          // curiosity points that can count toward the bar
  limitHours: number;   // hours a week the plate can hold (always WEEKLY_HOURS)
}

const DAY_MS = 86_400_000;

function days(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function addDays(isoDay: string, n: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Points a week that every fixed-date item needs, as of the Monday
 *  `start`: what it had left then, over the weeks left to its date (all
 *  of it, when the date falls within the week). On the plate or not.
 *  Only what was known before that Monday counts: parts finished before
 *  it, activity plans made before it, and the price it had then (a
 *  re-measure on or after that Monday leaves the week alone). */
export function floorFor(items: ScoreItem[], start: string): number {
  let pts = 0;
  for (const item of items) {
    /* Practice still to do, in points at the base rate (a quarter hour
       each, without the retrieval weighting): a floor, so it errs low. */
    const extra = extraLeftMinutes(item, start) / MINUTES_PER_POINT;
    if (!item.fixedDate || !item.deadline || item.deadline < start || (!item.parts.length && !extra)) continue;
    if (item.unbooked && start >= BOOKED_FROM) continue;
    let left = extra;
    if (item.remeasured && start <= item.remeasured.on) left += item.remeasured.before - item.remeasured.after;
    for (const g of item.parts) {
      const before = g.done.reduce((n, e) => {
        const d = parseDone(e);
        return d && d.date < start ? n + d.qty : n;
      }, 0);
      const done = Math.min(g.count, g.prior + before);
      left += g.points - Math.round((g.points * done) / g.count);
    }
    pts += left / (Math.max(7, days(start, item.deadline)) / 7);
  }
  return Math.round(pts);
}

function fixed(start: string): WeekRule {
  return { start, bar: WEEKLY_BAR, floor: 0, cap: CURIOSITY_CAP, limitHours: (WEEKLY_BAR * MINUTES_PER_POINT) / 60 };
}

/** Every week's rule from `first` to `last` (Mondays), oldest first.
 *  `counted(start, cap)` is what a week counted toward its bar: quests
 *  plus curiosity up to that cap. */
export function weekRules(
  items: ScoreItem[],
  first: string,
  last: string,
  counted: (start: string, cap: number) => number,
): WeekRule[] {
  const out: WeekRule[] = [];
  let prev: WeekRule | null = null;
  for (let w = first; w <= last; w = addDays(w, 7)) {
    let rule: WeekRule;
    if (w < BAR.from || !prev) {
      rule = fixed(w);
    } else {
      const moved = prev.bar + BAR.pull * (counted(prev.start, prev.cap) - prev.bar);
      const floor = floorFor(items, w);
      const roundTo = (n: number) => Math.round(n / BAR.round) * BAR.round;
      const bar = Math.min(WEEKLY_BAR, Math.max(Math.ceil(floor / BAR.round) * BAR.round, roundTo(moved)));
      rule = {
        start: w,
        bar,
        floor,
        cap: w >= RATIO_FROM ? Math.max(0, bar - floor) : Math.round(bar * BAR.capShare),
        limitHours: (WEEKLY_BAR * MINUTES_PER_POINT) / 60,
      };
    }
    out.push(rule);
    prev = rule;
  }
  return out;
}
