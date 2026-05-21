/*
 * Memento mori — the foundational stance of the site (BRIEF Part I).
 *
 * Centralised arithmetic over the author's birthdate. Every counter
 * shown anywhere on the site reads from these helpers, so a single
 * change to the birth constant or the convention (70-year grid, week
 * boundaries, etc.) propagates everywhere.
 *
 * Counters present LIFE LIVED, not life remaining. The grid renders
 * a fixed 70-year canvas — shorter than the Tim Urban 90-year
 * default; matches a working-life span more honestly — but never
 * colours past cells as "dead". Viewers project their own expected
 * ending. The FACT of finitude is what counts, not the prediction.
 */

/* Birth: 2007-08-16, treated as midnight local-to-place-of-birth
   (UAE / Asia/Dubai). The choice of timezone matters only for the
   first-day-of-life arithmetic; counts at week+ resolution are stable
   under all reasonable tz choices. */
export const BIRTH_ISO = '2007-08-16T00:00:00+04:00';
export const BIRTH_MS  = new Date(BIRTH_ISO).getTime();

/* "Your Life in Weeks" canvas at 70 years × 52 weeks = 3,640 cells.
   Shorter than Tim Urban's 90 convention; matches a realistic
   working-life span more honestly than the long-tail-of-old-age
   variant. Still just a convention, not a prediction. */
export const GRID_YEARS = 70;
export const WEEKS_PER_YEAR = 52;
export const GRID_WEEKS = GRID_YEARS * WEEKS_PER_YEAR;

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS   = 60 * MINUTE_MS;
const DAY_MS    = 24 * HOUR_MS;
const WEEK_MS   = 7  * DAY_MS;
/* Years/months at 365.25 / 30.4375 — enough precision for "you are
   ~18.5 years old" without leap-year-induced jitter. */
const YEAR_MS   = 365.25 * DAY_MS;
const MONTH_MS  = YEAR_MS / 12;

export interface LifeCounters {
  /** Milliseconds since birth (the ticking number under all of these). */
  ms: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  /** "Current week of life" — 1-indexed, rolls over every 7 days
   *  starting at birth. Same value used on the calendar grid, the
   *  status pulse, and the Weeks row in LifeTickers — so all three
   *  always agree (rather than diverging by 1 from a floor/ceil
   *  mismatch). Reads as "you're currently in your Nth week of life". */
  weeks: number;
  months: number;
  years: number;          // decimal — e.g. 18.523
  yearsRounded: number;   // floored — e.g. 18
  /** Alias of `weeks`, kept for older callers; both values are
   *  always identical now. New code should use `weeks`. */
  weekOfLife: number;
}

export function lifeCounters(nowMs: number = Date.now()): LifeCounters {
  const ms = Math.max(0, nowMs - BIRTH_MS);
  const weeks = Math.floor(ms / WEEK_MS) + 1;
  return {
    ms,
    seconds: Math.floor(ms / SECOND_MS),
    minutes: Math.floor(ms / MINUTE_MS),
    hours:   Math.floor(ms / HOUR_MS),
    days:    Math.floor(ms / DAY_MS),
    weeks,
    months:  Math.floor(ms / MONTH_MS),
    years:   ms / YEAR_MS,
    yearsRounded: Math.floor(ms / YEAR_MS),
    weekOfLife:   weeks,
  };
}
