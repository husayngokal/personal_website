/*
 * The scoring system: every rule and rate, in one place.
 *
 * This file IS the system. Studio never edits it and nothing in the vault
 * can override it; items only supply rough inputs (a page count, a number
 * of modules, a gut estimate) and these rules turn them into points. A
 * change here is a public decision: log it in the changed-my-mind log.
 *
 * Points are frozen into an item when it is set up (see block.ts), so a
 * change to a rate applies to new items going forward and never rewrites
 * points already earned.
 *
 * The public page /life/scoring renders straight from these constants, so
 * the explanation can never drift from the maths.
 *
 * Pure module, no I/O.
 */

export type Lane = 'quest' | 'curiosity';
export type Tier = 'light' | 'normal' | 'technical' | 'dense';

/** First Monday the system counts. Anything dated earlier is history:
 *  it shows as progress but earns no points. */
export const SCORE_EPOCH = '2026-10-19';

/** One point is fifteen focused minutes. */
export const MINUTES_PER_POINT = 15;

/** The weekly bar. Full means done for the week; anything past it is
 *  optional extra. 200 points = 50 hours. */
export const WEEKLY_BAR = 200;
export const WEEKLY_HOURS = (WEEKLY_BAR * MINUTES_PER_POINT) / 60;

/** Curiosity can fill at most this much of the weekly bar (20 hours).
 *  Quests are uncapped. Curiosity past the cap still counts toward the
 *  lifetime total, never the week. */
export const CURIOSITY_CAP = 80;

/** A level per this many lifetime points (about five full weeks). */
export const LEVEL_SIZE = 1000;

/** Gut estimates run 2 to 3x short (measured: BlueDot section one took
 *  10 hours against an expected 5). The low end corrects them. */
export const GUT_FACTOR = 2;

/** Formula estimates (pages at a reading speed, published course hours,
 *  hiking time from distance and climb) leave out breaks and setup. */
export const FORMULA_FACTOR = 1.25;

export const READING_TIERS: Record<Tier, { label: string; minutesPerPage: number; example: string }> = {
  light:     { label: 'Light',     minutesPerPage: 0.5, example: 'self-help, popular non-fiction' },
  normal:    { label: 'Normal',    minutesPerPage: 1,   example: 'most books' },
  technical: { label: 'Technical', minutesPerPage: 4,   example: 'textbooks with mathematics' },
  dense:     { label: 'Dense',     minutesPerPage: 10,  example: 'research papers' },
};

/** Finished prose: essays and writeups score once, on publish, by length.
 *  Edits never score. */
export const WORDS_PER_HOUR = 300;

/** A task with no estimate of its own: a gut figure by scope. */
export const TASK_GUT_HOURS: Record<string, number> = {
  today: 1, 'this-week': 2, 'this-month': 4, 'this-quarter': 8, 'this-year': 12, lifetime: 8,
};

/** A recurring routine, per occurrence. */
export const RECURRING_GUT_HOURS: Record<string, number> = {
  daily: 0.25, weekly: 1, monthly: 2, quarterly: 3, yearly: 6,
};

/** Field Atlas outings are timed gate to gate: Naismith's rule for the
 *  walk, plus the drive and setup. Entries without distance or climb fall
 *  back to a typical day for their discipline. */
export const ATLAS = {
  kmPerHour: 5,
  metresClimbPerHour: 600,
  logisticsHours: 3,
  defaultHours: { hiking: 6, diving: 8, fishing: 6 } as Record<string, number>,
};

/** Default lane by surface. An item can override it in its score block. */
export const DEFAULT_LANE: Record<string, Lane> = {
  tasks: 'quest',
  exams: 'quest',
  projects: 'quest',
  library: 'curiosity',
  courses: 'curiosity',
  atlas: 'curiosity',
  list: 'curiosity',
  notebook: 'curiosity',
  writeups: 'curiosity',
};

/* -- Conversions ---------------------------------------------------- */

export function hoursToPoints(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.max(1, Math.round((hours * 60) / MINUTES_PER_POINT));
}

export const estimate = {
  /** Your own guess, corrected for the measured underestimate. */
  gut: (hours: number) => hoursToPoints(hours * GUT_FACTOR),
  /** A formula or published figure, with breaks and setup added. */
  formula: (hours: number) => hoursToPoints(hours * FORMULA_FACTOR),
  /** Something already timed (a past paper's sitting plus review). */
  measured: (hours: number) => hoursToPoints(hours),
  pages: (pages: number, tier: Tier) =>
    hoursToPoints(((pages * READING_TIERS[tier].minutesPerPage) / 60) * FORMULA_FACTOR),
  words: (words: number) => hoursToPoints(words / WORDS_PER_HOUR),
};

/** Gate-to-gate points for a Field Atlas line: Naismith's rule from its
 *  distance and climb, plus the drive, or a typical day for the discipline. */
export function atlasPoints(text: string, heading: string): number {
  const km = (() => {
    const m = text.match(/(\d+(?:\.\d+)?)\s*(?:[–-]\s*(\d+(?:\.\d+)?))?\s*km\b/);
    return m ? Number(m[2] ?? m[1]) : 0;
  })();
  const climb = (() => {
    const m = text.match(/\+(\d{2,5})\s*m\b/);
    return m ? Number(m[1]) : 0;
  })();
  const h = heading.toLowerCase();
  const discipline = h.includes('div') ? 'diving' : h.includes('fish') ? 'fishing' : 'hiking';
  const hours = km || climb
    ? ATLAS.logisticsHours + km / ATLAS.kmPerHour + climb / ATLAS.metresClimbPerHour
    : ATLAS.defaultHours[discipline];
  return estimate.formula(hours);
}

/** Weeks a task's scope spans, for spreading its hours across the week. */
export const SCOPE_WEEKS: Record<string, number> = {
  today: 1, 'this-week': 1, 'this-month': 4, 'this-quarter': 13, 'this-year': 52, lifetime: 52,
};

/** Points earned by finishing parts `before`..`after` of a group: the same
 *  cumulative rounding the engine uses, so a prediction matches exactly. */
export function partGain(points: number, count: number, before: number, after: number): number {
  const a = Math.min(count, Math.max(before, after));
  return Math.round((points * a) / count) - Math.round((points * before) / count);
}

/** Pages that make one point at a tier, for display. */
export function pagesPerPoint(tier: Tier): number {
  return MINUTES_PER_POINT / (READING_TIERS[tier].minutesPerPage * FORMULA_FACTOR);
}

/* -- Templates -------------------------------------------------------
 * What Studio asks when something new is set up for scoring. Each one
 * takes two or three rough answers and returns a frozen score block.
 */

export type TemplateId = 'exam-prep' | 'book' | 'course' | 'task';

export interface TemplateField {
  key: string;
  label: string;
  kind: 'number' | 'text' | 'tier' | 'lane';
  optional?: boolean;
  hint?: string;
}

/** Every template asks this: it is what the 50-hour limit adds up. */
const WEEKLY: TemplateField = {
  key: 'weeklyHours', label: 'Hours a week it will take while active', kind: 'number',
  hint: `counts toward the ${WEEKLY_HOURS}-hour week`,
};

export const TEMPLATES: Record<TemplateId, { label: string; fields: TemplateField[] }> = {
  'exam-prep': {
    label: 'Exam prep',
    fields: [
      { key: 'unit', label: 'What is one part called?', kind: 'text', hint: 'module, chapter, unit' },
      { key: 'count', label: 'How many parts?', kind: 'number' },
      { key: 'hoursEach', label: 'Your gut hours for one part', kind: 'number' },
      { key: 'repeatUnit', label: 'Something you can repeat', kind: 'text', optional: true, hint: 'past paper' },
      { key: 'repeatHours', label: 'Hours one takes, all in', kind: 'number', optional: true },
      WEEKLY,
    ],
  },
  book: {
    label: 'Book',
    fields: [
      { key: 'pages', label: 'Pages', kind: 'number' },
      { key: 'tier', label: 'Tier', kind: 'tier' },
      WEEKLY,
    ],
  },
  course: {
    label: 'Course',
    fields: [
      { key: 'hours', label: 'Total hours (published, or your measured pace)', kind: 'number' },
      { key: 'unit', label: 'What is one part called?', kind: 'text', hint: 'module, week, section' },
      { key: 'count', label: 'How many parts?', kind: 'number' },
      { key: 'lane', label: 'Lane', kind: 'lane' },
      WEEKLY,
    ],
  },
  task: {
    label: 'Task or project',
    fields: [
      { key: 'hours', label: 'Your gut hours for the whole thing', kind: 'number' },
      { key: 'count', label: 'How many milestones?', kind: 'number', hint: '1 if it is one piece' },
      { key: 'lane', label: 'Lane', kind: 'lane' },
      WEEKLY,
    ],
  },
};
