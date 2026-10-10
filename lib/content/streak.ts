/*
 * Activity streak — pure maths over a list of active days.
 *
 * A week (Monday to Sunday) counts when the vault changed on at least one
 * day in it. The streak is the run of consecutive counted weeks ending at
 * the current week. A current week with nothing in it yet does not break
 * the streak until it is over: on a Tuesday you still hold last week's run.
 *
 * Weekly, not daily, on purpose. The site is meant to be touched a few
 * times a week; a daily streak would sit at zero and teach nothing.
 *
 * Days are 'YYYY-MM-DD' strings in the author's timezone. Pure module.
 */

export const AUTHOR_TZ_OFFSET_HOURS = 4;   // Asia/Dubai, no DST

export interface Streak {
  weeks: number;              // current streak length in weeks
  thisWeekActive: boolean;    // has the current week been counted yet
  daysThisWeek: number;       // active days so far this week
  recent: boolean[];          // last 12 weeks, oldest first, current week last
  lastActiveDay: string | null;
}

/** 'YYYY-MM-DD' for a moment in time, in the author's timezone. */
export function authorDay(at: Date | number = Date.now()): string {
  const ms = (typeof at === 'number' ? at : at.getTime()) + AUTHOR_TZ_OFFSET_HOURS * 3_600_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Monday of the week containing `day`, as 'YYYY-MM-DD'. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;        // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function addWeeks(monday: string, n: number): string {
  const d = new Date(`${monday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * n);
  return d.toISOString().slice(0, 10);
}

export function computeStreak(days: string[], today: string = authorDay()): Streak {
  const activeWeeks = new Set(days.map(weekStart));
  const thisWeek = weekStart(today);
  const thisWeekActive = activeWeeks.has(thisWeek);

  let weeks = 0;
  let cursor = thisWeekActive ? thisWeek : addWeeks(thisWeek, -1);
  while (activeWeeks.has(cursor)) {
    weeks++;
    cursor = addWeeks(cursor, -1);
  }

  const recent: boolean[] = [];
  for (let i = 11; i >= 0; i--) recent.push(activeWeeks.has(addWeeks(thisWeek, -i)));

  const sorted = [...days].sort();
  return {
    weeks,
    thisWeekActive,
    daysThisWeek: new Set(days.filter((d) => weekStart(d) === thisWeek)).size,
    recent,
    lastActiveDay: sorted.length ? sorted[sorted.length - 1] : null,
  };
}
