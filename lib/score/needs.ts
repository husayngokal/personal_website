/*
 * What needs the author's hand in Studio, worked out from the score: a
 * date that has passed, a plate over its limit, something unpriced, a
 * re-measure that is due. Empty when nothing does, so the list only
 * shows up when there is something to do.
 *
 * Pure module, no I/O.
 */

import type { ItemView, ScoreState } from './compute';

/** current_state key the midnight refresh writes each time it runs. */
export const REFRESH_KEY = 'score_refresh';
/** It runs every night; a day and a half without a run means it stopped. */
const REFRESH_STALE_MS = 36 * 3_600_000;
/** Before this the refresh had no record to keep; a missing one after it
 *  means it has never run since it started keeping one. */
const REFRESH_WATCH_FROM = '2026-11-04';

export type Need =
  | { kind: 'refresh'; last: string | null }
  | { kind: 'held'; sources: string[]; date: string }
  | { kind: 'over'; hours: number; capacity: number; biggest: ItemView[] }
  | { kind: 'overdue'; item: ItemView }
  | { kind: 'exam-passed'; item: ItemView }
  | { kind: 'setup'; item: ItemView }
  | { kind: 'remeasure'; item: ItemView };

const SOURCE_NAMES: Record<string, string> = { gut: 'guesses', stated: 'published hours', formula: 'counted content' };

export function needsYou(
  items: ItemView[],
  load: ScoreState['load'] | null | undefined,
  today: string,
  extra: { calibration?: ScoreState['calibration'] | null; refreshAt?: string | null; now?: number } = {},
): Need[] {
  const plate = items.filter((i) => i.active);
  const out: Need[] = [];
  const now = extra.now ?? Date.now();
  if (extra.refreshAt !== undefined) {
    const last = extra.refreshAt;
    if (last ? now - Date.parse(last) > REFRESH_STALE_MS : today >= REFRESH_WATCH_FROM) out.push({ kind: 'refresh', last });
  }
  /* A monthly review that would have moved a factor past half or double
     where it started holds it instead: the one thing that asks for a look. */
  const review = extra.calibration?.history?.[extra.calibration.history.length - 1];
  if (review) {
    const held = Object.entries(review.classes).filter(([, c]) => c.held).map(([k]) => SOURCE_NAMES[k] ?? k);
    if (held.length) out.push({ kind: 'held', sources: held, date: review.date });
  }
  if (load && load.hours > load.capacity) {
    const biggest = plate
      .filter((i) => (i.weeklyHours ?? 0) > 0)
      .sort((a, b) => (b.weeklyHours ?? 0) - (a.weeklyHours ?? 0))
      .slice(0, 3);
    out.push({ kind: 'over', hours: load.hours, capacity: load.capacity, biggest });
  }
  for (const item of plate) {
    if (item.deadline && item.deadline < today) {
      out.push(item.table === 'study_credentials' ? { kind: 'exam-passed', item } : { kind: 'overdue', item });
    }
  }
  for (const item of plate) if (item.needsSetup) out.push({ kind: 'setup', item });
  for (const item of plate) if (item.remeasure && !item.needsSetup) out.push({ kind: 'remeasure', item });
  return out;
}
