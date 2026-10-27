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

/* -- Where an estimate comes from --------------------------------------
 * Every price records its source, picked by precedence before any of the
 * work is timed: an official timing if there is one; else a content
 * measure (pages or words at a reading tier, video minutes, route time);
 * else the provider's stated hours; else my own guess, entered raw for the
 * whole thing and never corrected by hand, because the source's factor
 * does the correcting.
 *
 * A factor turns a source's raw number into the focused minutes the work
 * is expected to take. Formula, stated and gut factors learn from the
 * record once a month (calibrate.ts). Official timings never do: re-rating
 * a fixed timing from my own speed would only pay slow work more.
 *
 * `pace` marks parts priced from my own measured speed before these rules
 * began. Nothing new is priced that way, and those parts never learn.
 */

export type Source = 'measured' | 'formula' | 'stated' | 'gut' | 'pace';
export type Learning = 'formula' | 'stated' | 'gut';
export type Factors = Record<Learning, number>;
export const LEARNING: Learning[] = ['formula', 'stated', 'gut'];

/** Where each learning factor starts. Formula: 1.25 for breaks and setup
 *  (about 120 words a minute on a 600-word technical page). Stated: 1,
 *  since published hours tend to run long, not short. Gut: 2, from one
 *  recalled section, so only a starting point. */
export const STARTING_FACTORS: Factors = { formula: 1.25, stated: 1, gut: 2 };

export const SOURCES: Record<Source, { label: string; learns: boolean }> = {
  measured: { label: 'an official timing', learns: false },
  formula: { label: 'a content measure', learns: true },
  stated: { label: 'published hours', learns: true },
  gut: { label: 'a guess', learns: true },
  pace: { label: 'my own measured pace (priced before these rules)', learns: false },
};

export function isSource(v: unknown): v is Source {
  return typeof v === 'string' && v in SOURCES;
}

/** The starting factors under their older names. Plain tasks, routines
 *  and Field Atlas outings always use these: their defaults are rough by
 *  design, and a learned factor would move their points every month. */
export const GUT_FACTOR = STARTING_FACTORS.gut;
export const FORMULA_FACTOR = STARTING_FACTORS.formula;

/** The pricing rules below apply to anything priced from this day. */
export const RULES_FROM = '2026-10-27';

/** Calibration (calibrate.ts). Prices never change; each learning source's
 *  factor is reviewed on the first Monday of each month and applies to
 *  things priced after it. */
export const CALIBRATION = {
  firstReview: '2026-11-02',
  windowWeeks: 26,          // items whose latest finished part is this recent
  minItemMinutes: 20,       // an item needs at least this much timed work
  clamp: 3,                 // each item's time is held within a third and three times its price
  itemShare: 0.25,          // no item carries more than a quarter of the weight
  trustK: 5,                // trust in the record: items / (items + 5)
  step: 0.1,                // a review moves a factor at most a tenth
  guard: 2,                 // past half or double its start, a factor is held for review by hand
};

/** The most one part can be worth. Bigger work is split into parts, so a
 *  misprice is bounded both ways; a guessed part is held tighter. An
 *  official timing (a past paper) is one indivisible unit, and exempt. */
export const UNIT_CAP = { default: 16, gut: 8 };

export function unitCap(source: Source): number {
  return source === 'gut' ? UNIT_CAP.gut : UNIT_CAP.default;
}

/** Does a group of `count` parts worth `points` in all keep every part
 *  under the cap? (Spread by cumulative rounding, no part exceeds the cap
 *  when the average does not.) */
export function fitsCap(points: number, count: number, source: Source): boolean {
  return source === 'measured' || points <= unitCap(source) * Math.max(1, count);
}

/** The fewest parts `points` can be split into under its cap. */
export function minParts(points: number, source: Source): number {
  return source === 'measured' ? 1 : Math.max(1, Math.ceil(points / unitCap(source)));
}

/** A finished part that took under half or over double its price gets a
 *  one-line public note on how it was priced. No effect on points. */
export const VARIANCE = { low: 0.5, high: 2 };

/** Reading speeds. Text counted in words (an article, a web page) is
 *  turned into pages at the tier's own page size: a book page for light
 *  and normal reading, a 600-word page for technical and dense. */
export const READING_TIERS: Record<Tier, { label: string; minutesPerPage: number; wordsPerPage: number; example: string }> = {
  light:     { label: 'Light',     minutesPerPage: 0.5, wordsPerPage: 300, example: 'self-help, popular non-fiction' },
  normal:    { label: 'Normal',    minutesPerPage: 1,   wordsPerPage: 300, example: 'most books, essays and articles' },
  technical: { label: 'Technical', minutesPerPage: 4,   wordsPerPage: 600, example: 'textbooks with mathematics, policy and legal reports' },
  dense:     { label: 'Dense',     minutesPerPage: 10,  wordsPerPage: 600, example: 'research papers' },
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

/** Something whose size can be counted before the work starts: pages,
 *  words, and video or audio at its running time. */
export interface Content { pages?: number; words?: number; tier?: Tier; videoMinutes?: number }

/** Minutes a piece of content holds at the reading tiers, before its factor. */
export function contentMinutes(c: Content): number {
  const t = READING_TIERS[c.tier ?? 'normal'];
  const n = (x: number | undefined) => (Number.isFinite(x) && (x as number) > 0 ? (x as number) : 0);
  return (n(c.pages) + n(c.words) / t.wordsPerPage) * t.minutesPerPage + n(c.videoMinutes);
}

/** Raw hours times the factor in force for their source. */
export const estimate = {
  /** My own guess. */
  gut: (hours: number, factor = STARTING_FACTORS.gut) => hoursToPoints(hours * factor),
  /** A formula: pages at a reading speed, walking time from distance and climb. */
  formula: (hours: number, factor = STARTING_FACTORS.formula) => hoursToPoints(hours * factor),
  /** A provider's published hours. */
  stated: (hours: number, factor = STARTING_FACTORS.stated) => hoursToPoints(hours * factor),
  /** An official timing (a past paper's set length). Never corrected. */
  measured: (hours: number) => hoursToPoints(hours),
  pages: (pages: number, tier: Tier, factor = STARTING_FACTORS.formula) =>
    hoursToPoints(((pages * READING_TIERS[tier].minutesPerPage) / 60) * factor),
  content: (c: Content, factor = STARTING_FACTORS.formula) => hoursToPoints((contentMinutes(c) / 60) * factor),
  words: (words: number) => hoursToPoints(words / WORDS_PER_HOUR),
};

/** Factors print as 2, 1.25, 1.8. */
export function factorLabel(f: number): string {
  return String(Math.round(f * 100) / 100);
}

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

/* -- Activities -------------------------------------------------------
 * The work around the material: everything done to actually pass, beyond
 * understanding the chapters. Each kind has a unit you log a count of and
 * a realistic time per unit; points follow from that, never typed in.
 *
 * Retrieval practice (recalling from memory: flashcard reviews, practice
 * questions, past papers) is what turns understanding into marks, and it
 * is the hardest work to make yourself do. It earns RETRIEVAL_FACTOR on
 * its time. First-pass learning (a statute, a case) does not.
 *
 * Making flashcards never scores: they are made by AI.
 */

export const RETRIEVAL_FACTOR = 1.5;

export type ActivityKind = 'flashcard-review' | 'mcq' | 'written-question' | 'past-paper' | 'statute' | 'case' | 'other';

export interface ActivitySpec {
  label: string;
  unit: string;
  minutesPerUnit?: number;
  retrieval: boolean;
  /** What setting it up asks: a past paper's official length, or (for
   *  anything else) a unit and your gut minutes per unit. */
  asks?: 'paperHours' | 'custom';
  basis: string;
}

export const ACTIVITIES: Record<ActivityKind, ActivitySpec> = {
  'flashcard-review': { label: 'Flashcard reviews', unit: 'card', minutesPerUnit: 0.25, retrieval: true, basis: '15 seconds a card, including failed cards relearned' },
  mcq: { label: 'Practice questions, multiple choice', unit: 'question', minutesPerUnit: 2.7, retrieval: true, basis: '1.7 minutes to answer (the SQE pace) and 1 to review' },
  'written-question': { label: 'Practice questions, written', unit: 'question', minutesPerUnit: 45, retrieval: true, basis: '36 minutes to answer (five to a 3-hour paper) and 9 to review' },
  'past-paper': { label: 'Past paper', unit: 'past paper', retrieval: true, asks: 'paperHours', basis: 'its official length, and half again to mark it' },
  statute: { label: 'Learning statutes', unit: 'statute', minutesPerUnit: 10, retrieval: false, basis: '10 minutes to read, understand and note one' },
  case: { label: 'Learning cases', unit: 'case', minutesPerUnit: 8, retrieval: false, basis: '8 minutes for the facts, the ratio and the principle' },
  other: { label: 'Something else (your guess per unit)', unit: '', retrieval: false, asks: 'custom', basis: 'your gut minutes per unit, times the guess factor in force, at most 8 points a unit' },
};

/** A past paper is marked as well as sat. */
export const PAPER_MARKING_FACTOR = 1.5;

/** Frozen numbers for a new activity: either units per point (counts) or
 *  points per unit (a past paper). */
export function activityRate(kind: ActivityKind, opts: { paperHours?: number; minutesPerUnit?: number; gut?: number } = {}): { per?: number; points?: number } {
  const a = ACTIVITIES[kind];
  if (kind === 'past-paper') {
    const h = Number(opts.paperHours);
    if (!Number.isFinite(h) || h <= 0) throw new Error("a past paper needs its official length in hours");
    return { points: hoursToPoints(h * PAPER_MARKING_FACTOR * RETRIEVAL_FACTOR) };
  }
  const m = kind === 'other' ? Number(opts.minutesPerUnit) * (opts.gut ?? STARTING_FACTORS.gut) : (a.minutesPerUnit ?? 0) * (a.retrieval ? RETRIEVAL_FACTOR : 1);
  if (!Number.isFinite(m) || m <= 0) throw new Error('minutes per unit must be a positive number');
  if (kind === 'other' && m / MINUTES_PER_POINT > UNIT_CAP.gut) {
    throw new Error(`one unit would be worth ${Math.round(m / MINUTES_PER_POINT)} points; a guessed unit can be worth at most ${UNIT_CAP.gut}, so use a smaller unit`);
  }
  return { per: Math.round((MINUTES_PER_POINT / m) * 1000) / 1000 };
}

/** Points a run of counted units earns: cumulative rounding over the whole
 *  log, so small logs add up exactly. */
export function countGain(per: number, before: number, after: number): number {
  return Math.round(after / per) - Math.round(before / per);
}

/* -- Timed work -------------------------------------------------------
 * Time scores only for work with no button of its own (supplementary
 * reading, a one-off), at half its real rate: hours are input, not output,
 * and a timer cannot tell focus from drift. At stop you confirm the
 * focused minutes (never more than the timer ran); one session counts for
 * at most three hours. Points are frozen into the log line.
 */

export const TIMED_FACTOR = 0.5;
export const TIMED_SESSION_CAP_MIN = 180;

export function timedPoints(focusedMinutes: number): number {
  const m = Math.max(0, Math.min(TIMED_SESSION_CAP_MIN, Math.round(focusedMinutes)));
  return Math.round((m / MINUTES_PER_POINT) * TIMED_FACTOR);
}

/* -- Templates -------------------------------------------------------
 * What Studio asks when something new is set up for scoring. Each one
 * takes two or three rough answers and returns a frozen score block.
 */

export type TemplateId = 'exam-prep' | 'book' | 'course' | 'task';

export interface TemplateField {
  key: string;
  label: string;
  kind: 'number' | 'text' | 'tier' | 'lane' | 'basis';
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
      { key: 'hoursEach', label: 'Your gut hours for one part', kind: 'number', hint: 'a guessed part can be worth at most 8 points' },
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
      { key: 'hours', label: 'Total hours', kind: 'number', hint: 'the course\'s published figure, or your guess' },
      { key: 'basis', label: 'Those hours are', kind: 'basis' },
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
      { key: 'count', label: 'How many milestones?', kind: 'number', hint: 'a guessed part can be worth at most 8 points' },
      { key: 'lane', label: 'Lane', kind: 'lane' },
      { ...WEEKLY, optional: true, hint: 'blank: worked out from its due date or scope' },
    ],
  },
};
