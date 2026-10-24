/*
 * One-tap updates: the pure core.
 *
 * Turns a small named action ("bump this book 10%", "task done", "hike
 * logged") into a new version of one vault file, plus the matching patch
 * for its Postgres row and the request that would undo it.
 *
 * Everything here is pure: file text in, file text out. The route handler
 * (app/api/studio/quick) does the I/O around it. Two guarantees matter:
 *
 *   1. Increments are computed from the FILE's current value, never from
 *      what the page last showed, so a double tap or a stale tab cannot
 *      write a wrong number.
 *   2. The result is run through the real vault parser before it is
 *      returned. A one-tap edit can therefore never commit a file the
 *      sync would reject (which would freeze that surface, see the
 *      parse-error notes in CLAUDE.md).
 *
 * No 'server-only' import on purpose: this file is exercised by plain
 * tsx scripts.
 */

import matter from 'gray-matter';
import { patchFrontmatter, type ScalarChange } from '../vault/frontmatter-patch';
import { itemLabel, listDoneItems, setItemDone } from '../vault/done-items';
import { parseFile } from '../vault/parse';
import { TEMPLATES, estimate, type TemplateId } from '../score/rules';
import {
  addGroup, buildFromTemplate, editGroup, logParts, logRepeat, partsDone, readBlock, removeGroup, setScoreBlock,
  type ScoreBlock, type TemplateInputs,
} from '../score/block';
import { atlasPoints, effectiveBlock, itemFromFile, plural } from '../score/items';

export type FrontmatterTarget = 'book' | 'task' | 'project';
export type QuickTarget = FrontmatterTarget | 'atlas' | 'score';

/* Tables whose items carry a score block, and where their files live. */
export const SCORE_TABLES: Record<string, { folder: string | null; keys: string[]; columns: string[] }> = {
  library_books:     { folder: 'library',           keys: ['status', 'progress-pct', 'finished'], columns: ['status', 'progress_pct', 'finished'] },
  tasks:             { folder: null,                keys: ['status', 'scope', 'completed'],        columns: ['status', 'scope', 'completed'] },
  courses:           { folder: 'courses',           keys: ['status', 'finished'],                  columns: ['status', 'finished'] },
  study_credentials: { folder: 'study/credentials', keys: [],                                      columns: [] },
  projects:          { folder: 'projects',          keys: ['status'],                              columns: ['status'] },
};

/* Taking something off the plate, per kind. Exams have a date someone
   else set; they come off only by being sat. */
const PARK: Record<string, Record<string, string>> = {
  tasks: { scope: 'lifetime' },
  library_books: { status: 'planned' },
  courses: { status: 'planned' },
  projects: { status: 'paused' },
};

export type QuickRequest =
  | { target: 'book'; slug: string; action: 'bump'; by: number }
  | { target: 'book'; slug: string; action: 'finish' | 'shelve' }
  | { target: 'task'; slug: string; action: 'done' | 'reopen' | 'this-week' | 'later' }
  | { target: 'project'; slug: string; action: 'set-active'; on: boolean }
  | { target: 'atlas'; slug: string; action: 'done' | 'undone'; line: string }
  | { target: FrontmatterTarget; slug: string; action: 'restore'; fields: Record<string, ScalarChange> }
  | { target: 'score'; table: string; slug: string; action: 'part'; group: number; qty?: number }
  | { target: 'score'; table: string; slug: string; action: 'repeat'; group: number }
  | { target: 'score'; table: string; slug: string; action: 'page'; page: number }
  | { target: 'score'; table: string; slug: string; action: 'setup'; template: TemplateId; inputs: TemplateInputs }
  | { target: 'score'; table: string; slug: string; action: 'add-group'; unit: string; name?: string; count: number; hours: number; basis: 'gut' | 'measured' }
  | { target: 'score'; table: string; slug: string; action: 'edit-group'; group: number; name?: string; count?: number; prior?: number }
  | { target: 'score'; table: string; slug: string; action: 'remove-group'; group: number }
  | { target: 'score'; table: string; slug: string; action: 'park' }
  | { target: 'score'; table: string; slug: string; action: 'restore-block'; block: ScoreBlock | null; fields?: Record<string, ScalarChange> };

interface TargetSpec {
  table: string;
  /** Folder used to guess the path when the sync's path index has no entry. */
  folder: string | null;
  /** Frontmatter keys a one-tap action may touch (also the undo whitelist). */
  keys: string[];
  /** Row columns copied from the parser's output into the DB write-through. */
  columns: string[];
}

export const QUICK_TARGETS: Record<QuickTarget, TargetSpec> = {
  book:    { table: 'library_books',  folder: 'library',  keys: ['status', 'progress-pct', 'finished'], columns: ['status', 'progress_pct', 'finished'] },
  task:    { table: 'tasks',          folder: null,       keys: ['status', 'scope', 'completed'],      columns: ['status', 'scope', 'completed'] },
  project: { table: 'projects',       folder: 'projects', keys: ['status'],                            columns: ['status'] },
  atlas:   { table: 'living_entries', folder: 'living',   keys: [],                                    columns: ['body'] },
  /* table/folder/keys/columns for score requests come from SCORE_TABLES,
     keyed by the request's own `table`; see specFor(). */
  score:   { table: '',               folder: null,       keys: [],                                    columns: [] },
};

/** The target spec for a request, resolving score requests by table. */
export function specFor(req: { target: QuickTarget; table?: string }): TargetSpec | null {
  if (req.target !== 'score') return QUICK_TARGETS[req.target] ?? null;
  const t = req.table ? SCORE_TABLES[req.table] : undefined;
  return t ? { table: req.table!, ...t } : null;
}

export interface QuickResult {
  raw: string;                       // new file content
  changed: boolean;
  row: Record<string, unknown>;      // patch for the Postgres row
  summary: string;                   // one line for the UI and the commit
  undo: QuickRequest | null;
  line?: string;                     // atlas: the item's new source line
}

export class QuickError extends Error {
  constructor(public code: 'bad-request' | 'stale' | 'invalid-result', message: string) {
    super(message);
    this.name = 'QuickError';
  }
}

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function scalar(v: unknown): ScalarChange {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return v;
  return String(v);
}

function changesFor(req: QuickRequest, fm: Record<string, unknown>, today: string): { changes: Record<string, ScalarChange>; verb: string } {
  switch (req.target) {
    case 'book':
      if (req.action === 'bump') {
        if (!Number.isFinite(req.by) || Math.abs(req.by) > 100) throw new QuickError('bad-request', 'bad increment');
        const next = clampPct((Number(fm['progress-pct']) || 0) + req.by);
        return { changes: { 'progress-pct': next }, verb: `${next}%` };
      }
      if (req.action === 'finish') return { changes: { status: 'finished', finished: today, 'progress-pct': 100 }, verb: 'finished' };
      if (req.action === 'shelve') return { changes: { status: 'planned' }, verb: 'back to planned' };
      break;
    case 'task':
      if (req.action === 'done') return { changes: { status: 'done', completed: today }, verb: 'done' };
      if (req.action === 'reopen') return { changes: { status: 'open', completed: null }, verb: 'reopened' };
      if (req.action === 'this-week') return { changes: { scope: 'this-week' }, verb: 'moved to this week' };
      if (req.action === 'later') return { changes: { scope: 'lifetime' }, verb: 'moved to later' };
      break;
    case 'project':
      /* The one switch a project has: actively being worked on, or not.
         Off parks it as `paused`; lifecycle states (shipped, concluded,
         dead) are set through the full edit form, not from here. */
      if (req.action === 'set-active') {
        return req.on
          ? { changes: { status: 'active' }, verb: 'actively working on it' }
          : { changes: { status: 'paused' }, verb: 'not working on it right now' };
      }
      break;
  }
  if (req.action === 'restore') {
    const allowed = QUICK_TARGETS[req.target].keys;
    const fields = req.fields ?? {};
    for (const [k, v] of Object.entries(fields)) {
      if (!allowed.includes(k)) throw new QuickError('bad-request', `cannot restore ${k}`);
      if (v !== null && typeof v !== 'string' && typeof v !== 'number') throw new QuickError('bad-request', `bad value for ${k}`);
    }
    return { changes: fields, verb: 'undone' };
  }
  throw new QuickError('bad-request', 'unknown action');
}

export function applyQuick(req: QuickRequest, path: string, raw: string, today: string): QuickResult {
  const spec = specFor(req as { target: QuickTarget; table?: string });
  if (!spec) throw new QuickError('bad-request', 'unknown target');
  if (req.target === 'score') return finish(applyScore(req, path, raw, today), path, spec);

  let next = raw;
  let summary: string;
  let undo: QuickRequest | null;
  let line: string | undefined;

  if (req.target === 'atlas') {
    if (req.action !== 'done' && req.action !== 'undone') throw new QuickError('bad-request', 'unknown action');
    if (typeof req.line !== 'string' || !req.line) throw new QuickError('bad-request', 'missing item');
    /* Logging an outing dates it and freezes its points into the line. */
    let stamp: { day: string; points: number } | undefined;
    if (req.action === 'done') {
      const group = listDoneItems(matter(raw).content).find((g) => g.items.some((i) => i.line === req.line));
      const item = group?.items.find((i) => i.line === req.line);
      if (group && item) stamp = { day: today, points: atlasPoints(item.text, group.heading) };
    }
    let flipped: { raw: string; line: string };
    try {
      flipped = setItemDone(raw, req.line, req.action === 'done', stamp);
    } catch (err) {
      throw new QuickError('stale', (err as Error).message);
    }
    next = flipped.raw;
    line = flipped.line;
    const label = itemLabel(req.line);
    summary = `${label}: ${req.action === 'done' ? `logged as done${stamp ? `, +${stamp.points}` : ''}` : 'marked not done'}`;
    undo = { target: 'atlas', slug: req.slug, action: req.action === 'done' ? 'undone' : 'done', line };
  } else {
    const fm = matter(raw).data as Record<string, unknown>;
    const { changes, verb } = changesFor(req, fm, today);
    const previous: Record<string, ScalarChange> = {};
    for (const k of Object.keys(changes)) previous[k] = scalar(fm[k]);
    try {
      next = patchFrontmatter(raw, changes);
    } catch (err) {
      throw new QuickError('invalid-result', (err as Error).message);
    }
    summary = `${String(fm.title ?? req.slug)}: ${verb}`;
    undo = { target: req.target, slug: req.slug, action: 'restore', fields: previous };
  }

  return finish({ raw: next, changed: next !== raw, row: {}, summary, undo, line }, path, spec);
}

/* The gate: the edited file must still be a file the sync accepts, and
   must still land in the table we think we are editing. */
function finish(result: QuickResult, path: string, spec: TargetSpec): QuickResult {
  let parsed;
  try {
    parsed = parseFile(path, result.raw);
  } catch (err) {
    throw new QuickError('invalid-result', `edit would break the file: ${(err as Error).message}`);
  }
  if (!parsed || parsed.ignored || parsed.table !== spec.table) {
    throw new QuickError('invalid-result', `${path} is not a ${spec.table} file`);
  }
  const source = parsed.row as Record<string, unknown>;
  const row: Record<string, unknown> = {};
  for (const c of spec.columns) row[c] = source[c] ?? null;
  return { ...result, row };
}

type ScoreRequest = Extract<QuickRequest, { target: 'score' }>;

/* Score actions: log a part, a repeat or a page, set an item up from a
   template, or put a block back (undo). Every one works from the file's
   current block, never from what the page last showed. */
function applyScore(req: ScoreRequest, path: string, raw: string, today: string): QuickResult {
  const fm = matter(raw).data as Record<string, unknown>;
  const title = String(fm.title ?? req.slug);
  const own = readBlock(fm);
  const prevFields: Record<string, ScalarChange> = {};
  const undo = (fields?: Record<string, ScalarChange>): QuickRequest => ({
    target: 'score', table: req.table, slug: req.slug, action: 'restore-block', block: own,
    ...(fields && Object.keys(fields).length ? { fields } : {}),
  });

  if (req.action === 'restore-block') {
    const allowed = SCORE_TABLES[req.table]?.keys ?? [];
    let next = setScoreBlock(raw, req.block ?? null);
    if (req.fields) {
      for (const k of Object.keys(req.fields)) {
        if (!allowed.includes(k)) throw new QuickError('bad-request', `cannot restore ${k}`);
      }
      next = patchFrontmatter(next, req.fields);
    }
    return { raw: next, changed: next !== raw, row: {}, summary: `${title}: undone`, undo: null };
  }

  if (req.action === 'setup') {
    if (own) throw new QuickError('bad-request', 'this item is already set up; its points are frozen');
    if (!(req.template in TEMPLATES)) throw new QuickError('bad-request', 'unknown template');
    const item = itemFromFile({ path, content: raw });
    if (!item) throw new QuickError('bad-request', 'this file cannot be scored');
    let block: ScoreBlock;
    try {
      block = buildFromTemplate(req.template, req.inputs ?? {}, item.surface);
    } catch (err) {
      throw new QuickError('bad-request', (err as Error).message);
    }
    const next = setScoreBlock(raw, block);
    const total = block.parts.reduce((s, g) => s + g.points, 0);
    return { raw: next, changed: true, row: {}, summary: `${title}: set up, ${total} points in all`, undo: undo() };
  }

  if (req.action === 'park') {
    const park = PARK[req.table];
    if (!park) throw new QuickError('bad-request', 'an exam comes off the plate by being sat, not parked');
    const prev: Record<string, ScalarChange> = {};
    for (const k of Object.keys(park)) prev[k] = scalar(fm[k]);
    const next = patchFrontmatter(raw, park);
    return { raw: next, changed: next !== raw, row: {}, summary: `${title}: off the plate`, undo: undo(prev) };
  }

  /* Logging. An item scored by defaults (a plain or recurring task) gets
     those defaults frozen into its file on the first log. */
  let block = own;
  if (!block) {
    const item = itemFromFile({ path, content: raw });
    if (!item || (!item.parts.length && !item.repeat.length)) {
      throw new QuickError('bad-request', 'set this item up for scoring first');
    }
    block = effectiveBlock(item);
  }

  let nextBlock: ScoreBlock;
  let verb: string;
  const fields: Record<string, ScalarChange> = {};
  try {
    if (req.action === 'add-group') {
      const hours = Number(req.hours);
      if (!Number.isFinite(hours) || hours <= 0) throw new Error('hours must be a positive number');
      const points = req.basis === 'measured' ? estimate.measured(hours) : estimate.gut(hours);
      nextBlock = addGroup(block, { unit: String(req.unit ?? ''), name: req.name, count: Number(req.count), points });
      verb = `added ${req.name?.trim() || req.unit} (${Math.round(Number(req.count))} ${plural(String(req.unit).trim())}, ${points} points)`;
    } else if (req.action === 'edit-group') {
      const g = block.parts[req.group];
      if (!g) throw new Error('no such part');
      nextBlock = editGroup(block, req.group, {
        name: req.name,
        count: req.count === undefined ? undefined : Number(req.count),
        prior: req.prior === undefined ? undefined : Number(req.prior),
      });
      const n = nextBlock.parts[req.group];
      verb = `${n.name ?? n.unit} is now ${n.count} ${plural(n.unit)}${n.prior ? `, ${n.prior} done before scoring` : ''}`;
    } else if (req.action === 'remove-group') {
      const g = block.parts[req.group];
      if (!g) throw new Error('no such part');
      nextBlock = removeGroup(block, req.group);
      verb = `removed ${g.name ?? g.unit}`;
    } else if (req.action === 'part') {
      const g = block.parts[req.group];
      if (!g) throw new Error('no such part');
      nextBlock = logParts(block, req.group, req.qty ?? 1, today);
      const n = partsDone(nextBlock.parts[req.group]) - partsDone(g);
      verb = `${n > 1 ? `${n} ${plural(g.unit)}` : g.unit} done (${partsDone(nextBlock.parts[req.group])} of ${g.count})`;
    } else if (req.action === 'repeat') {
      const g = block.repeat[req.group];
      if (!g) throw new Error('no such repeatable');
      nextBlock = logRepeat(block, req.group, today);
      verb = `${g.unit} logged, +${g.points}`;
    } else if (req.action === 'page') {
      const gi = block.parts.findIndex((g) => g.unit === 'page');
      if (gi === -1) throw new Error('this book is not set up with pages');
      const g = block.parts[gi];
      const page = Math.round(Number(req.page));
      const at = partsDone(g);
      if (!Number.isFinite(page) || page <= at) throw new Error(`you are already on page ${at}`);
      nextBlock = logParts(block, gi, page - at, today);
      const reached = partsDone(nextBlock.parts[gi]);
      prevFields['progress-pct'] = fm['progress-pct'] === undefined ? null : Number(fm['progress-pct']);
      fields['progress-pct'] = Math.round((reached / g.count) * 100);
      if (reached >= g.count) {
        prevFields.status = fm.status === undefined ? null : String(fm.status);
        prevFields.finished = fm.finished instanceof Date ? fm.finished.toISOString().slice(0, 10) : (fm.finished as string | undefined) ?? null;
        fields.status = 'finished';
        fields.finished = today;
      }
      verb = reached >= g.count ? 'finished' : `on page ${reached} of ${g.count}`;
    } else {
      throw new Error('unknown action');
    }
  } catch (err) {
    throw new QuickError('bad-request', (err as Error).message);
  }

  /* 100%: the last part of the last group closes the item out. A course
     becomes completed, a task done. Books close on their last page above;
     exams close when the result is in; projects stay until switched off. */
  if (req.action === 'part' && nextBlock.parts.length && nextBlock.parts.every((g) => partsDone(g) >= g.count)) {
    const close: Record<string, Record<string, string>> = {
      courses: { status: 'completed', finished: today },
      tasks: { status: 'done', completed: today },
    };
    const c = close[req.table];
    if (c && !(req.table === 'tasks' && fm.recurrence)) {
      for (const [k, v] of Object.entries(c)) {
        prevFields[k] = scalar(fm[k]);
        fields[k] = v;
      }
      verb += ' · all done';
    }
  }

  let next = setScoreBlock(raw, nextBlock);
  if (Object.keys(fields).length) next = patchFrontmatter(next, fields);
  return { raw: next, changed: true, row: {}, summary: `${title}: ${verb}`, undo: undo(prevFields) };
}
