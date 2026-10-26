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
 *           each done entry finishes one part, or N with "+N". `prior`
 *           parts were finished before tracking and earn nothing.
 *   repeat  open-ended work. Every done entry earns `points`, no limit.
 *   outcome the reward for the result (an exam passed), paid once.
 *
 * Pure module, no I/O.
 */

import { estimate, DEFAULT_LANE, type Lane, type Tier, type TemplateId, READING_TIERS } from './rules';

export interface PartGroup {
  unit: string;
  name?: string;
  count: number;
  points: number;
  prior: number;
  done: string[];
  /** Points were re-estimated from timed pace (allowed once). */
  reestimated?: boolean;
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
  parts: PartGroup[];
  repeat: RepeatGroup[];
}

export interface DoneEntry { date: string; qty: number }

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-27" or "2026-10-27 +3"; YAML may hand over a Date. */
export function parseDone(v: unknown): DoneEntry | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return { date: v.toISOString().slice(0, 10), qty: 1 };
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(\d{4}-\d{2}-\d{2})(?:\s*\+(\d+))?$/);
  if (!m) return null;
  return { date: m[1], qty: m[2] ? Math.max(1, Number(m[2])) : 1 };
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
    if (d) out.push(d.qty > 1 ? `${d.date} +${d.qty}` : d.date);
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
  if (b.parts.length) {
    out.push('  parts:');
    for (const g of b.parts) {
      out.push(`    - unit: ${q(g.unit)}`);
      if (g.name) out.push(`      name: ${q(g.name)}`);
      out.push(`      count: ${g.count}`);
      out.push(`      points: ${g.points}`);
      out.push(`      prior: ${g.prior}`);
      if (g.reestimated) out.push('      reestimated: true');
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

/** Log `qty` finished parts on `day`. Throws if the group is already full. */
export function logParts(b: ScoreBlock, groupIndex: number, qty: number, day: string): ScoreBlock {
  const next = cloneBlock(b);
  const g = next.parts[groupIndex];
  if (!g) throw new Error('no such part group');
  if (!ISO_DAY.test(day)) throw new Error('bad day');
  const room = g.count - partsDone(g);
  if (room <= 0) throw new Error(`every ${g.unit} is already done`);
  const n = Math.max(1, Math.min(Math.round(qty), room));
  g.done.push(n > 1 ? `${day} +${n}` : day);
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
}

export function addGroup(b: ScoreBlock, g: GroupInput): ScoreBlock {
  const next = cloneBlock(b);
  const count = Math.round(g.count);
  if (!g.unit.trim()) throw new Error('a part needs a name for its unit');
  if (!Number.isFinite(count) || count < 1) throw new Error('count must be at least 1');
  if (!Number.isFinite(g.points) || g.points < 1) throw new Error('points must be at least 1');
  next.parts.push({
    unit: g.unit.trim(),
    name: g.name?.trim() || undefined,
    count,
    points: Math.round(g.points),
    prior: Math.max(0, Math.min(Math.round(g.prior ?? 0), count)),
    done: [],
  });
  return next;
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

/* -- Re-estimating from real pace --------------------------------------
 * Once the first parts of something are done and timed, the timing beats
 * any guess. This rescales every group of one unit (all the chapters of
 * all the books, keeping their relative sizes) so a part is worth what it
 * actually took: timed minutes per logged part, rounded up to the next
 * whole point. Allowed once, and only while no more than a quarter of the
 * parts are logged, so it cannot be used to pay slow work more later on.
 * The outcome, if it was the parts' estimate, follows.
 */

export function reestimate(b: ScoreBlock, unit: string, timedMinutes: number): { block: ScoreBlock; perPart: number; before: number; after: number } {
  const next = cloneBlock(b);
  const groups = next.parts.filter((g) => g.unit === unit);
  if (!groups.length) throw new Error(`no parts called ${unit}`);
  if (groups.some((g) => g.reestimated)) throw new Error('this has already been re-estimated once; its points are frozen');
  const logged = groups.reduce((n, g) => n + g.done.reduce((q, e) => q + (parseDone(e)?.qty ?? 0), 0), 0);
  const total = groups.reduce((n, g) => n + g.count, 0);
  if (logged < 1) throw new Error(`finish and log at least one ${unit} first`);
  if (logged > Math.ceil(total / 4)) throw new Error(`more than a quarter of the ${unit}s are already logged; too late to re-estimate`);
  if (!Number.isFinite(timedMinutes) || timedMinutes <= 0) throw new Error(`no timed sessions on this yet; time a ${unit} with the timer first`);

  /* The estimate's minutes for the parts that were logged, group by group. */
  let estimatedMin = 0;
  for (const g of groups) {
    const q = g.done.reduce((n, e) => n + (parseDone(e)?.qty ?? 0), 0);
    estimatedMin += (g.points / g.count) * q * 15;
  }
  const perPart = Math.ceil(timedMinutes / logged / 15) * 15;      // up to a whole point
  const factor = (perPart * logged) / estimatedMin;
  const before = next.parts.reduce((n, g) => n + g.points, 0);
  for (const g of groups) {
    g.points = Math.max(1, Math.round(g.points * factor));
    g.reestimated = true;
  }
  const after = next.parts.reduce((n, g) => n + g.points, 0);
  if (next.outcome !== undefined && next.outcome === before) next.outcome = after;
  return { block: next, perPart, before, after };
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

/** Turn a template's rough answers into a frozen score block. Every
 *  template also records the hours a week the item takes while active,
 *  which is what the weekly limit adds up. */
export function buildFromTemplate(id: TemplateId, inputs: TemplateInputs, surface: string): ScoreBlock {
  const block = buildParts(id, inputs, surface);
  const wh = Number(inputs.weeklyHours);
  /* A task can leave it blank: its pace then comes from its due date, or
     its estimate spread over its scope. Everything else must say. */
  if (id === 'task' && (inputs.weeklyHours === undefined || inputs.weeklyHours === '')) return block;
  if (!Number.isFinite(wh) || wh <= 0) throw new Error('Hours a week must be a positive number');
  block.weeklyHours = Math.round(wh * 10) / 10;
  return block;
}

function buildParts(id: TemplateId, inputs: TemplateInputs, surface: string): ScoreBlock {
  switch (id) {
    case 'exam-prep': {
      const count = Math.round(needNum(inputs, 'count', 'Number of parts'));
      const each = needNum(inputs, 'hoursEach', 'Hours per part');
      const points = estimate.gut(count * each);
      const block: ScoreBlock = {
        lane: 'quest', template: id, outcome: points,
        parts: [{ unit: String(inputs.unit || 'module').trim(), count, points, prior: 0, done: [] }],
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
        parts: [{ unit: 'page', count: pages, points: estimate.pages(pages, tier), prior: 0, done: [] }],
        repeat: [],
      };
    }
    case 'course': {
      const hours = needNum(inputs, 'hours', 'Hours');
      const count = Math.round(needNum(inputs, 'count', 'Number of parts'));
      return {
        lane: laneOf(inputs, surface), template: id,
        parts: [{ unit: String(inputs.unit || 'module').trim(), count, points: estimate.formula(hours), prior: 0, done: [] }],
        repeat: [],
      };
    }
    case 'task': {
      const hours = needNum(inputs, 'hours', 'Hours');
      const count = Math.max(1, Math.round(Number(inputs.count) || 1));
      const lane = laneOf(inputs, surface);
      const points = estimate.gut(hours);
      return {
        lane, template: id,
        parts: [{ unit: count > 1 ? 'milestone' : 'task', count, points, prior: 0, done: [] }],
        repeat: [],
      };
    }
  }
  throw new Error('unknown template');
}
