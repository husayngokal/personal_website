/*
 * The `score:` block in a vault file's frontmatter.
 *
 * Every scored item carries one. It holds the item's FROZEN numbers
 * (worked out once from rules.ts when the item was set up) and the dated
 * log of what has been finished:
 *
 *   score:
 *     lane: "quest"
 *     weekly-hours: 16
 *     outcome: 168
 *     parts:
 *       - unit: "module"
 *         count: 7
 *         points: 168
 *         prior: 0
 *         done: ["2026-10-27", "2026-10-29 +2"]
 *     repeat:
 *       - unit: "past paper"
 *         points: 20
 *         done: ["2026-11-02"]
 *
 *   parts   finite work. `points` is the total for all `count` parts;
 *           each done entry finishes one part, or N with "+N", stamped
 *           with the day and (since 27 Oct 2026) the time it was logged,
 *           "2026-10-27 16:36". `prior` parts were finished before
 *           tracking and earn nothing. `basis` and `factor` record where
 *           the price came from (rules.ts), `why` the same in words.
 *   repeat  open-ended work. Every done entry earns `points`, no limit.
 *   outcome the reward for the result (an exam passed), paid once.
 *
 * Pure module, no I/O.
 */

import {
  estimate, factorLabel, fitsCap, isSource, minParts, unitCap, DEFAULT_LANE, READING_TIERS, STARTING_FACTORS,
  type Content, type Factors, type Lane, type Source, type Tier, type TemplateId,
} from './rules';

export interface PartGroup {
  unit: string;
  name?: string;
  count: number;
  points: number;
  prior: number;
  done: string[];
  /** Older: points were re-estimated once from timed pace. No longer
   *  allowed (re-pricing from my own speed pays slow work); kept as a record. */
  reestimated?: boolean;
  /** Where the price came from, and the factor it was priced at. */
  basis?: Source;
  factor?: number;
  /** The basis in words: "120 pages, technical reading, x 1.25". */
  why?: string;
  /** Set only when finished parts were re-scored by hand afterwards (a
   *  one-time exception, 27 Oct 2026): the price committed before the work,
   *  which calibration and the notes still judge the estimate by. 0 means
   *  no price was committed before the work, so it never calibrates. */
  priced?: number;
}

export interface RepeatGroup {
  unit: string;
  /** Points per unit (a past paper). Ignored when `per` is set. */
  points: number;
  /** Units per point, for counted activities (40 flashcard reviews). */
  per?: number;
  /** The activity kind from rules.ts, when it came from the menu. */
  kind?: string;
  done: string[];
}

export interface ScoreBlock {
  lane?: Lane;
  template?: TemplateId;
  tier?: Tier;
  weeklyHours?: number;
  outcome?: number;
  /** Taken off the plate without changing the item's own status (how an
   *  exam comes off: its date and pending state stay true). */
  parked?: boolean;
  /** What taking it off the plate changed (e.g. { status: 'studying' }),
   *  so bringing it back restores exactly that. */
  parkedFrom?: Record<string, string>;
  /** The one content re-measure of its unstarted parts (rules.ts): when,
   *  and whether anything could be counted. */
  remeasured?: { on: string; counted: boolean };
  parts: PartGroup[];
  repeat: RepeatGroup[];
}

export interface DoneEntry { date: string; time?: string; qty: number }

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "2026-10-27", "2026-10-27 16:36", "2026-10-27 +3" or "2026-10-27 16:36 +3";
 *  YAML may hand over a Date. Times are Dubai time. */
export function parseDone(v: unknown): DoneEntry | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return { date: v.toISOString().slice(0, 10), qty: 1 };
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?(?:\s*\+(\d+))?$/);
  if (!m) return null;
  return {
    date: m[1],
    ...(m[2] && HM.test(m[2]) ? { time: m[2] } : {}),
    qty: m[3] ? Math.max(1, Number(m[3])) : 1,
  };
}

/** The order finished parts are counted in: by day, then by time logged
 *  (an entry with no time sorts first on its day). Every reader of the
 *  log uses this, so the same entry always carries the same points. */
export function doneOrder(a: DoneEntry, b: DoneEntry): number {
  return a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '');
}

export function formatDone(e: DoneEntry): string {
  return `${e.date}${e.time ? ` ${e.time}` : ''}${e.qty > 1 ? ` +${e.qty}` : ''}`;
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function doneList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const d = parseDone(x);
    if (d) out.push(formatDone(d));
  }
  return out;
}

/** Read a block out of parsed frontmatter. Never mutates its input (gray-
 *  matter caches parse results, so the object is shared). Returns null
 *  when there is no usable block. */
export function readBlock(fm: Record<string, unknown>): ScoreBlock | null {
  const raw = fm.score;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const lane = r.lane === 'quest' || r.lane === 'curiosity' ? r.lane : undefined;
  const tier = typeof r.tier === 'string' && r.tier in READING_TIERS ? (r.tier as Tier) : undefined;
  const template = typeof r.template === 'string' ? (r.template as TemplateId) : undefined;

  const parts: PartGroup[] = [];
  for (const g of Array.isArray(r.parts) ? r.parts : []) {
    if (!g || typeof g !== 'object') continue;
    const o = g as Record<string, unknown>;
    const count = num(o.count);
    const points = num(o.points);
    if (!count || count < 1 || points === undefined || points < 0) continue;
    parts.push({
      unit: str(o.unit) ?? 'part',
      name: str(o.name),
      count: Math.round(count),
      points: Math.round(points),
      prior: Math.max(0, Math.min(Math.round(num(o.prior) ?? 0), Math.round(count))),
      done: doneList(o.done),
      ...(o.reestimated === true ? { reestimated: true } : {}),
      ...(isSource(o.basis) ? { basis: o.basis } : {}),
      ...(num(o.factor) && num(o.factor)! > 0 ? { factor: num(o.factor) } : {}),
      ...(str(o.why) ? { why: str(o.why) } : {}),
      ...(num(o.priced) !== undefined && num(o.priced)! >= 0 ? { priced: Math.round(num(o.priced)!) } : {}),
    });
  }

  const repeat: RepeatGroup[] = [];
  for (const g of Array.isArray(r.repeat) ? r.repeat : []) {
    if (!g || typeof g !== 'object') continue;
    const o = g as Record<string, unknown>;
    const points = num(o.points);
    const per = num(o.per);
    if ((points === undefined || points < 0) && !(per && per > 0)) continue;
    repeat.push({
      unit: str(o.unit) ?? 'session',
      points: Math.round(points ?? 0),
      ...(per && per > 0 ? { per } : {}),
      ...(str(o.kind) ? { kind: str(o.kind) } : {}),
      done: doneList(o.done),
    });
  }

  return {
    lane,
    template,
    tier,
    weeklyHours: num(r['weekly-hours']),
    outcome: num(r.outcome),
    parked: r.parked === true ? true : undefined,
    parkedFrom: (() => {
      const v = r['parked-from'];
      if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
      const out: Record<string, string> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (/^[a-z][a-z-]*$/.test(k) && (typeof x === 'string' || typeof x === 'number')) out[k] = String(x);
        else if (/^[a-z][a-z-]*$/.test(k) && x instanceof Date) out[k] = x.toISOString().slice(0, 10);
      }
      return Object.keys(out).length ? out : undefined;
    })(),
    remeasured: (() => {
      const v = r.remeasured;
      if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
      const o = v as Record<string, unknown>;
      const on = o.on instanceof Date ? o.on.toISOString().slice(0, 10) : str(o.on);
      return on && ISO_DAY.test(on) ? { on, counted: o.counted === true } : undefined;
    })(),
    parts,
    repeat,
  };
}

/* -- Writing --------------------------------------------------------- */

const q = (s: string) => JSON.stringify(s);
const list = (xs: string[]) => `[${xs.map(q).join(', ')}]`;

export function serializeBlock(b: ScoreBlock): string[] {
  const out = ['score:'];
  if (b.lane) out.push(`  lane: ${q(b.lane)}`);
  if (b.template) out.push(`  template: ${q(b.template)}`);
  if (b.tier) out.push(`  tier: ${q(b.tier)}`);
  if (b.weeklyHours !== undefined) out.push(`  weekly-hours: ${b.weeklyHours}`);
  if (b.outcome !== undefined) out.push(`  outcome: ${b.outcome}`);
  if (b.parked) out.push('  parked: true');
  if (b.parked && b.parkedFrom) out.push(`  parked-from: ${JSON.stringify(b.parkedFrom)}`);
  if (b.remeasured) out.push(`  remeasured: ${JSON.stringify(b.remeasured)}`);
  if (b.parts.length) {
    out.push('  parts:');
    for (const g of b.parts) {
      out.push(`    - unit: ${q(g.unit)}`);
      if (g.name) out.push(`      name: ${q(g.name)}`);
      out.push(`      count: ${g.count}`);
      out.push(`      points: ${g.points}`);
      out.push(`      prior: ${g.prior}`);
      if (g.reestimated) out.push('      reestimated: true');
      if (g.basis) out.push(`      basis: ${q(g.basis)}`);
      if (g.factor !== undefined) out.push(`      factor: ${g.factor}`);
      if (g.why) out.push(`      why: ${q(g.why)}`);
      if (g.priced !== undefined) out.push(`      priced: ${g.priced}`);
      out.push(`      done: ${list(g.done)}`);
    }
  }
  if (b.repeat.length) {
    out.push('  repeat:');
    for (const g of b.repeat) {
      out.push(`    - unit: ${q(g.unit)}`);
      if (g.kind) out.push(`      kind: ${q(g.kind)}`);
      if (g.per) out.push(`      per: ${g.per}`);
      else out.push(`      points: ${g.points}`);
      out.push(`      done: ${list(g.done)}`);
    }
  }
  return out;
}

/** Replace (or add, or with null remove) the top-level `score:` block,
 *  leaving every other byte of the file as it was. */
export function setScoreBlock(raw: string, block: ScoreBlock | null): string {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(eol);
  if (lines[0] !== '---') throw new Error('file has no frontmatter block');
  const close = lines.indexOf('---', 1);
  if (close === -1) throw new Error('frontmatter block is not closed');

  const fm = lines.slice(1, close);
  let at = fm.findIndex((l) => /^score:\s*$/.test(l));
  if (at !== -1) {
    let end = at + 1;
    while (end < fm.length && /^[ \t]/.test(fm[end])) end++;
    fm.splice(at, end - at);
  } else {
    at = fm.length;
  }
  if (block) fm.splice(at, 0, ...serializeBlock(block));
  return [lines[0], ...fm, ...lines.slice(close)].join(eol);
}

/* -- Logging --------------------------------------------------------- */

/** How many parts of a group are finished, prior work included. */
export function partsDone(g: PartGroup): number {
  let n = g.prior;
  for (const e of g.done) n += parseDone(e)?.qty ?? 0;
  return Math.min(n, g.count);
}

export function cloneBlock(b: ScoreBlock): ScoreBlock {
  return {
    ...b,
    parts: b.parts.map((g) => ({ ...g, done: [...g.done] })),
    repeat: b.repeat.map((g) => ({ ...g, done: [...g.done] })),
  };
}

/** Log `qty` finished parts on `day`, at `time` (Dubai, HH:MM) when known,
 *  so timed work can be matched to the part it bought. Throws if the group
 *  is already full. */
export function logParts(b: ScoreBlock, groupIndex: number, qty: number, day: string, time?: string): ScoreBlock {
  const next = cloneBlock(b);
  const g = next.parts[groupIndex];
  if (!g) throw new Error('no such part group');
  if (!ISO_DAY.test(day)) throw new Error('bad day');
  const room = g.count - partsDone(g);
  if (room <= 0) throw new Error(`every ${g.unit} is already done`);
  const n = Math.max(1, Math.min(Math.round(qty), room));
  g.done.push(formatDone({ date: day, ...(time && HM.test(time) ? { time } : {}), qty: n }));
  return next;
}

export function logRepeat(b: ScoreBlock, groupIndex: number, day: string, qty = 1): ScoreBlock {
  const next = cloneBlock(b);
  const g = next.repeat[groupIndex];
  if (!g) throw new Error('no such repeatable');
  if (!ISO_DAY.test(day)) throw new Error('bad day');
  const n = Math.round(Number(qty));
  if (!Number.isFinite(n) || n < 1) throw new Error('how many must be at least 1');
  g.done.push(n > 1 ? `${day} +${n}` : day);
  return next;
}

/** Units logged on a repeat group so far. */
export function repeatCount(g: RepeatGroup): number {
  return g.done.reduce((n, e) => n + (parseDone(e)?.qty ?? 0), 0);
}

export function addActivity(b: ScoreBlock, g: { unit: string; kind: string; per?: number; points?: number }): ScoreBlock {
  const next = cloneBlock(b);
  if (!g.unit.trim()) throw new Error('an activity needs a unit');
  if (next.repeat.some((x) => x.kind === g.kind && x.unit === g.unit)) throw new Error('that activity is already here');
  next.repeat.push({
    unit: g.unit.trim(), kind: g.kind,
    points: Math.round(g.points ?? 0), ...(g.per ? { per: g.per } : {}),
    done: [],
  });
  return next;
}

export function removeActivity(b: ScoreBlock, index: number): ScoreBlock {
  const next = cloneBlock(b);
  const g = next.repeat[index];
  if (!g) throw new Error('no such activity');
  if (g.done.length > 0) throw new Error(`${g.unit} already has logged work; it cannot be removed`);
  next.repeat.splice(index, 1);
  return next;
}

/* -- Shaping an item's parts ------------------------------------------
 * An item can hold several part groups: one per book of a course, say,
 * each with its own number of chapters. These edit that list from Studio.
 *
 * The guard that keeps points frozen: a group's count can change only
 * while nothing in it has been logged. Its points total never changes,
 * so re-counting just re-spreads the same points over its parts. Adding
 * a group adds its own points; the item's outcome stays as it was set.
 */

export interface GroupInput {
  unit: string;
  name?: string;
  count: number;
  points: number;
  prior?: number;
  basis: Source;
  factor: number;
  why?: string;
}

export function addGroup(b: ScoreBlock, g: GroupInput): ScoreBlock {
  const next = cloneBlock(b);
  const count = Math.round(g.count);
  if (!g.unit.trim()) throw new Error('a part needs a name for its unit');
  if (!Number.isFinite(count) || count < 1) throw new Error('count must be at least 1');
  if (!Number.isFinite(g.points) || g.points < 1) throw new Error('points must be at least 1');
  capCheck(Math.round(g.points), count, g.basis, g.unit.trim());
  next.parts.push({
    unit: g.unit.trim(),
    name: g.name?.trim() || undefined,
    count,
    points: Math.round(g.points),
    prior: Math.max(0, Math.min(Math.round(g.prior ?? 0), count)),
    done: [],
    basis: g.basis,
    factor: g.factor,
    ...(g.why ? { why: g.why } : {}),
  });
  return next;
}

/** Refuse a group whose parts would be worth more than the cap allows. */
export function capCheck(points: number, count: number, basis: Source, unit: string): void {
  if (fitsCap(points, count, basis)) return;
  const each = Math.round(points / count);
  const need = minParts(points, basis);
  throw new Error(
    `each ${unit} would be worth ${each} points; ${basis === 'gut' ? 'a guessed part' : 'a part'} can be worth at most ${unitCap(basis)}, ` +
    `so it needs at least ${need} parts. Use a smaller part.`,
  );
}

export function editGroup(
  b: ScoreBlock, index: number, change: { name?: string; count?: number; prior?: number },
): ScoreBlock {
  const next = cloneBlock(b);
  const g = next.parts[index];
  if (!g) throw new Error('no such part group');
  if (change.name !== undefined) g.name = change.name.trim() || undefined;
  const reshaping = (change.count !== undefined && Math.round(change.count) !== g.count)
    || (change.prior !== undefined && Math.round(change.prior) !== g.prior);
  if (reshaping && g.done.length > 0) {
    throw new Error(`${g.name ?? g.unit} already has logged ${plural0(g.unit)}; its count is frozen`);
  }
  if (change.count !== undefined) {
    const c = Math.round(change.count);
    if (!Number.isFinite(c) || c < 1) throw new Error('count must be at least 1');
    /* Fewer parts means bigger ones: the cap holds here too. */
    if (g.basis && c < g.count) capCheck(g.points, c, g.basis, g.unit);
    g.count = c;
  }
  if (change.prior !== undefined) {
    g.prior = Math.max(0, Math.min(Math.round(change.prior), g.count));
  }
  g.prior = Math.min(g.prior, g.count);
  return next;
}

export function removeGroup(b: ScoreBlock, index: number): ScoreBlock {
  const next = cloneBlock(b);
  const g = next.parts[index];
  if (!g) throw new Error('no such part group');
  if (g.done.length > 0) throw new Error(`${g.name ?? g.unit} already has logged work; it cannot be removed`);
  next.parts.splice(index, 1);
  return next;
}

function plural0(unit: string): string {
  return /(s|x|ch|sh)$/.test(unit) ? `${unit}es` : `${unit}s`;
}

/* -- Re-measuring from content ------------------------------------------
 * The one change a price can get after the work starts. Once the first part
 * of something priced from published hours or a guess is finished, its
 * unstarted parts are re-priced from what they contain (pages, words,
 * video minutes, at the reading tiers), up or down, whatever that first
 * part took: the first part's time is never looked at, so going slowly
 * buys nothing. Once only. Finished parts keep their points exactly: a
 * part-done group is cut so each logged entry keeps its own frozen points.
 * When nothing left can be counted, the prices stay and it is not asked
 * again.
 */

export function remeasureDue(b: ScoreBlock | null): boolean {
  if (!b || b.remeasured) return false;
  const priced = b.parts.filter((g) => g.basis === 'stated' || g.basis === 'gut');
  return priced.some((g) => g.done.length > 0) && priced.some((g) => partsDone(g) < g.count);
}

export function remeasure(
  b: ScoreBlock, content: Content | null, formulaFactor: number, day: string,
): { block: ScoreBlock; before: number; after: number } {
  if (b.remeasured) throw new Error('this has already been re-measured once; its prices are frozen');
  if (!remeasureDue(b)) throw new Error('only something priced from published hours or a guess, with its first part done, is re-measured');
  const next = cloneBlock(b);
  const open = (g: PartGroup) => (g.basis === 'stated' || g.basis === 'gut') && partsDone(g) < g.count;
  const leftPoints = (g: PartGroup) => g.points - Math.round((g.points * partsDone(g)) / g.count);
  const before = next.parts.filter(open).reduce((n, g) => n + leftPoints(g), 0);
  if (!content) {
    next.remeasured = { on: day, counted: false };
    return { block: next, before, after: before };
  }
  const total = estimate.content(content, formulaFactor);
  const why = contentWhy(content, formulaFactor);
  const groups: PartGroup[] = [];
  const weights = next.parts.map((g) => (open(g) ? leftPoints(g) : 0));
  const wSum = weights.reduce((a, c) => a + c, 0) || 1;
  let given = 0, wSeen = 0;
  next.parts.forEach((g, i) => {
    if (!open(g)) { groups.push(g); return; }
    const done = partsDone(g);
    /* The finished share keeps its points entry by entry. */
    if (g.prior > 0) {
      groups.push({ ...g, name: g.name, count: g.prior, points: Math.round((g.points * g.prior) / g.count), prior: g.prior, done: [] });
    }
    let n = g.prior;
    for (const e of g.done.map(parseDone).filter((x): x is DoneEntry => !!x).sort(doneOrder)) {
      if (n >= g.count) break;
      const q = Math.min(g.count - n, e.qty);
      const pts = Math.round((g.points * (n + q)) / g.count) - Math.round((g.points * n) / g.count);
      groups.push({ ...g, count: q, points: pts, prior: 0, done: [formatDone(e)] });
      n += q;
    }
    /* The rest, re-priced: its share of the new total, by the old sizes. */
    wSeen += weights[i];
    const share = Math.round((total * wSeen) / wSum) - given;
    given += share;
    const left = g.count - done;
    const count = Math.max(left, minParts(share, 'formula'));
    groups.push({
      unit: count === left ? g.unit : 'part', name: g.name, count, points: Math.max(1, share), prior: 0, done: [],
      basis: 'formula', factor: formulaFactor, why,
    });
  });
  next.parts = groups;
  next.remeasured = { on: day, counted: true };
  return { block: next, before, after: total };
}

export function contentWhy(c: Content, factor: number): string {
  const bits: string[] = [];
  if (c.pages) bits.push(`${Math.round(c.pages)} pages`);
  if (c.words) bits.push(`${Math.round(c.words).toLocaleString('en-GB')} words`);
  const reading = bits.length ? `${bits.join(' and ')} at ${READING_TIERS[c.tier ?? 'normal'].label.toLowerCase()} reading` : '';
  const video = c.videoMinutes ? `${Math.round(c.videoMinutes)} min of video` : '';
  return `${[reading, video].filter(Boolean).join(', ')}, x ${factorLabel(factor)}`;
}

/* -- Templates -------------------------------------------------------- */

export type TemplateInputs = Record<string, string | number | undefined>;

function needNum(inputs: TemplateInputs, key: string, label: string): number {
  const n = Number(inputs[key]);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be a positive number`);
  return n;
}

function laneOf(inputs: TemplateInputs, surface: string): Lane {
  const v = inputs.lane;
  if (v === 'quest' || v === 'curiosity') return v;
  return DEFAULT_LANE[surface] ?? 'curiosity';
}

/** Turn a template's rough answers into a frozen score block, priced at
 *  the factors in force today. Every template also records the hours a
 *  week the item takes while active, which is what the weekly limit adds up. */
export function buildFromTemplate(id: TemplateId, inputs: TemplateInputs, surface: string, factors: Factors = STARTING_FACTORS): ScoreBlock {
  const block = buildParts(id, inputs, surface, factors);
  for (const g of block.parts) capCheck(g.points, g.count, g.basis ?? 'gut', g.unit);
  const wh = Number(inputs.weeklyHours);
  /* A task can leave it blank: its pace then comes from its due date, or
     its estimate spread over its scope. Everything else must say. */
  if (id === 'task' && (inputs.weeklyHours === undefined || inputs.weeklyHours === '')) return block;
  if (!Number.isFinite(wh) || wh <= 0) throw new Error('Hours a week must be a positive number');
  block.weeklyHours = Math.round(wh * 10) / 10;
  return block;
}

const hrs = (h: number) => `${Math.round(h * 100) / 100} ${h === 1 ? 'hour' : 'hours'}`;

function buildParts(id: TemplateId, inputs: TemplateInputs, surface: string, factors: Factors): ScoreBlock {
  switch (id) {
    case 'exam-prep': {
      const count = Math.round(needNum(inputs, 'count', 'Number of parts'));
      const each = needNum(inputs, 'hoursEach', 'Hours per part');
      const unit = String(inputs.unit || 'module').trim();
      const points = estimate.gut(count * each, factors.gut);
      const block: ScoreBlock = {
        lane: 'quest', template: id, outcome: points,
        parts: [{
          unit, count, points, prior: 0, done: [],
          basis: 'gut', factor: factors.gut, why: `${hrs(each)} a ${unit}, guessed, x ${factorLabel(factors.gut)}`,
        }],
        repeat: [],
      };
      const rUnit = typeof inputs.repeatUnit === 'string' ? inputs.repeatUnit.trim() : '';
      const rHours = Number(inputs.repeatHours);
      if (rUnit && Number.isFinite(rHours) && rHours > 0) {
        block.repeat.push({ unit: rUnit, points: estimate.measured(rHours), done: [] });
      }
      return block;
    }
    case 'book': {
      const pages = Math.round(needNum(inputs, 'pages', 'Pages'));
      const tier = (typeof inputs.tier === 'string' && inputs.tier in READING_TIERS ? inputs.tier : 'normal') as Tier;
      return {
        lane: laneOf(inputs, surface), template: id, tier,
        parts: [{
          unit: 'page', count: pages, points: estimate.pages(pages, tier, factors.formula), prior: 0, done: [],
          basis: 'formula', factor: factors.formula,
          why: `${pages} pages, ${READING_TIERS[tier].label.toLowerCase()} reading, x ${factorLabel(factors.formula)}`,
        }],
        repeat: [],
      };
    }
    case 'course': {
      const hours = needNum(inputs, 'hours', 'Hours');
      const count = Math.round(needNum(inputs, 'count', 'Number of parts'));
      const basis: Source = inputs.basis === 'gut' ? 'gut' : 'stated';
      const factor = factors[basis];
      const points = basis === 'gut' ? estimate.gut(hours, factor) : estimate.stated(hours, factor);
      return {
        lane: laneOf(inputs, surface), template: id,
        parts: [{
          unit: String(inputs.unit || 'module').trim(), count, points, prior: 0, done: [],
          basis, factor, why: `${hrs(hours)}, ${basis === 'gut' ? 'guessed' : 'published'}, x ${factorLabel(factor)}`,
        }],
        repeat: [],
      };
    }
    case 'task': {
      const hours = needNum(inputs, 'hours', 'Hours');
      const count = Math.max(1, Math.round(Number(inputs.count) || 1));
      const lane = laneOf(inputs, surface);
      const points = estimate.gut(hours, factors.gut);
      return {
        lane, template: id,
        parts: [{
          unit: count > 1 ? 'milestone' : 'task', count, points, prior: 0, done: [],
          basis: 'gut', factor: factors.gut, why: `${hrs(hours)}, guessed, x ${factorLabel(factors.gut)}`,
        }],
        repeat: [],
      };
    }
  }
  throw new Error('unknown template');
}

/** Split a guessed total into groups no part of which passes the cap:
 *  named milestones share it equally and each is cut into pieces if it
 *  must be; with no names it is one group of equal pieces. */
export function guessedParts(total: number, names: string[], factor: number, why: string): PartGroup[] {
  const base = { prior: 0, done: [] as string[], basis: 'gut' as Source, factor, why };
  if (!names.length) {
    const count = minParts(total, 'gut');
    return [{ ...base, unit: count > 1 ? 'piece' : 'task', count, points: total }];
  }
  return names.map((name, i) => {
    const points = Math.round((total * (i + 1)) / names.length) - Math.round((total * i) / names.length);
    const count = minParts(points, 'gut');
    return { ...base, unit: count > 1 ? 'piece' : 'milestone', name, count, points };
  });
}
