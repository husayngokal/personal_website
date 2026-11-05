/*
 * The weekly hours limits, shared by every route that can put something
 * on the plate (a Quick action, a new item added to this week).
 *
 * Two limits. The plate holds 50 hours whatever the lane. Curiosity on
 * the plate holds no more than this week's curiosity cap in hours (60
 * points is 15 hours), since hours past it could not fill the bar.
 *
 * Compares an item's hours a week before and after an edit against the
 * stored load. Only an increase can be refused, so taking things off
 * always works, and a plate that fit last week's cap is not touched when
 * this week's is lower. Pure apart from reading the item through the parser.
 */

import { itemFromFile } from './items';
import { MINUTES_PER_POINT } from './rules';
import type { ScoreState } from './compute';

export interface OverCapacity {
  detail: string;
  load: number;
  capacity: number;
  adding: number;
  plate: { table: string; slug: string; title: string; hours: number | null; parkable: boolean }[];
  /** Which limit: the whole plate, or the curiosity on it. */
  limit?: 'plate' | 'curiosity';
  /** The most hours a week this item could have and still fit. */
  fit?: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const hrs = (n: number) => `${n} ${n === 1 ? 'hour' : 'hours'}`;

export function overCapacity(score: ScoreState | null, path: string, raw: string): OverCapacity | null {
  if (!score) return null;
  const item = itemFromFile({ path, content: raw });
  if (!item || !item.active) return null;
  const prev = score.items.find((i) => i.key === path);
  const was = prev?.active ? prev.weeklyHours ?? 0 : 0;
  const will = item.weeklyHours ?? 0;
  /* Hours it could have instead, offered only when they would change
     something: more than it has now, and never for an item whose date
     sets its pace (a tap cannot change those hours). */
  const offer = (n: number) => (!item.paced && n > 0 && n > was ? n : undefined);
  if (will > was) {
    /* The plate's limit, the same every week (rules.ts WEEKLY_HOURS). */
    const limit = score.load.capacity;
    const load = r1(score.load.hours - was + will);
    if (load > limit) {
      return {
        detail: `That would put ${load} hours a week on the plate, over the ${limit}. Take something off first.`,
        load,
        capacity: limit,
        adding: r1(will - was),
        limit: 'plate',
        fit: offer(r1(limit - (score.load.hours - was))),
        plate: score.items
          .filter((i) => i.active && (i.weeklyHours ?? 0) > 0 && i.key !== path)
          .map((i) => ({ table: i.table, slug: i.slug, title: i.title, hours: i.weeklyHours, parkable: true })),
      };
    }
  }

  /* Curiosity: this week's cap in hours. A lane change counts too, so a
     quest turned curiosity is checked like one put on fresh.
     This week's curiosity is what is already logged plus what the plate
     still asks for: each curiosity item on the plate takes its hours a
     week or what it has already had, whichever is more, and curiosity
     logged on anything else adds on top. Logged hours start again on
     Monday, so a plate refused late in a week can fit the next one. */
  const wasCur = prev?.active && prev.lane === 'curiosity' ? prev.weeklyHours ?? 0 : 0;
  const willCur = item.lane === 'curiosity' ? will : 0;
  if (willCur <= wasCur) return null;
  const logged = (key: string) => (score.time?.byKey?.[key] ?? 0) / 60;
  const curLogged = (score.time?.weekByLane?.curiosity ?? 0) / 60;
  const others = score.items.filter((i) => i.active && i.lane === 'curiosity' && (i.weeklyHours ?? 0) > 0 && i.key !== path);
  /* This item's own time this week counts as curiosity only if it was
     curiosity when logged. */
  const ownLogged = !prev || prev.lane === 'curiosity' ? Math.min(curLogged, logged(path)) : 0;
  const othersLogged = others.reduce((n, i) => n + logged(i.key), 0);
  const offPlate = Math.max(0, curLogged - othersLogged - ownLogged);
  const rest = others.reduce((n, i) => n + Math.max(i.weeklyHours ?? 0, logged(i.key)), 0) + offPlate;
  const cap = r1((score.curiosityCap * MINUTES_PER_POINT) / 60);
  const load = r1(rest + Math.max(willCur, ownLogged));
  if (load <= cap) return null;
  const fit = offer(r1(cap - rest));
  const why = curLogged > 0 ? ` (${hrs(r1(curLogged))} already logged, the rest still planned)` : '';
  return {
    detail: `That would bring this week's curiosity to ${hrs(load)}${why}, over this week's ${hrs(cap)} (the curiosity cap of ${score.curiosityCap} points). `
      + (fit !== undefined ? `Give it ${hrs(fit)} a week or less, or take other curiosity off.`
        : item.paced ? `Its date sets its ${hrs(will)} a week, so take other curiosity off first.`
        : curLogged > 0 ? 'Take other curiosity off, or put it on from Monday, when the logged hours start again.' : 'Take other curiosity off first.'),
    load,
    capacity: cap,
    adding: r1(willCur - wasCur),
    limit: 'curiosity',
    fit,
    plate: others.map((i) => ({ table: i.table, slug: i.slug, title: i.title, hours: i.weeklyHours, parkable: true })),
  };
}
