/*
 * The weekly hours limit, shared by every route that can put something
 * on the plate (a Quick action, a new item added to this week).
 *
 * Compares an item's hours a week before and after an edit against the
 * stored load. Only an increase can be refused, so taking things off
 * always works. Pure apart from reading the item through the parser.
 */

import { itemFromFile } from './items';
import type { ScoreState } from './compute';

export interface OverCapacity {
  detail: string;
  load: number;
  capacity: number;
  adding: number;
  plate: { table: string; slug: string; title: string; hours: number | null; parkable: boolean }[];
}

export function overCapacity(score: ScoreState | null, path: string, raw: string): OverCapacity | null {
  if (!score) return null;
  const item = itemFromFile({ path, content: raw });
  if (!item || !item.active) return null;
  const prev = score.items.find((i) => i.key === path);
  const was = prev?.active ? prev.weeklyHours ?? 0 : 0;
  const will = item.weeklyHours ?? 0;
  if (will <= was) return null;
  /* The plate's limit, the same every week (rules.ts WEEKLY_HOURS). */
  const limit = score.load.capacity;
  const load = Math.round((score.load.hours - was + will) * 10) / 10;
  if (load <= limit) return null;
  return {
    detail: `That would put ${load} hours a week on the plate, over the ${limit}. Take something off first.`,
    load,
    capacity: limit,
    adding: Math.round((will - was) * 10) / 10,
    plate: score.items
      .filter((i) => i.active && (i.weeklyHours ?? 0) > 0 && i.key !== path)
      .map((i) => ({ table: i.table, slug: i.slug, title: i.title, hours: i.weeklyHours, parkable: true })),
  };
}
