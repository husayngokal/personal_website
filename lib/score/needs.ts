/*
 * What needs the author's hand in Studio, worked out from the score: a
 * date that has passed, a plate over its limit, something unpriced, a
 * re-measure that is due. Empty when nothing does, so the list only
 * shows up when there is something to do.
 *
 * Pure module, no I/O.
 */

import type { ItemView, ScoreState } from './compute';

export type Need =
  | { kind: 'over'; hours: number; capacity: number; biggest: ItemView[] }
  | { kind: 'overdue'; item: ItemView }
  | { kind: 'exam-passed'; item: ItemView }
  | { kind: 'setup'; item: ItemView }
  | { kind: 'remeasure'; item: ItemView };

export function needsYou(items: ItemView[], load: ScoreState['load'] | null | undefined, today: string): Need[] {
  const plate = items.filter((i) => i.active);
  const out: Need[] = [];
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
