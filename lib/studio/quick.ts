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
import { setItemDone } from '../vault/done-items';
import { parseFile } from '../vault/parse';

export type FrontmatterTarget = 'book' | 'task' | 'project';
export type QuickTarget = FrontmatterTarget | 'atlas';

export type QuickRequest =
  | { target: 'book'; slug: string; action: 'bump'; by: number }
  | { target: 'book'; slug: string; action: 'finish' | 'shelve' }
  | { target: 'task'; slug: string; action: 'done' | 'reopen' | 'this-week' | 'later' }
  | { target: 'project'; slug: string; action: 'active-today' }
  | { target: 'atlas'; slug: string; action: 'done' | 'undone'; line: string }
  | { target: FrontmatterTarget; slug: string; action: 'restore'; fields: Record<string, ScalarChange> };

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
  project: { table: 'projects',       folder: 'projects', keys: ['last-active'],                       columns: ['last_active'] },
  atlas:   { table: 'living_entries', folder: 'living',   keys: [],                                    columns: ['body'] },
};

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
      if (req.action === 'active-today') return { changes: { 'last-active': today }, verb: 'active today' };
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
  const spec = QUICK_TARGETS[req.target];
  if (!spec) throw new QuickError('bad-request', 'unknown target');

  let next = raw;
  let summary: string;
  let undo: QuickRequest | null;
  let line: string | undefined;

  if (req.target === 'atlas') {
    if (req.action !== 'done' && req.action !== 'undone') throw new QuickError('bad-request', 'unknown action');
    if (typeof req.line !== 'string' || !req.line) throw new QuickError('bad-request', 'missing item');
    let flipped: { raw: string; line: string };
    try {
      flipped = setItemDone(raw, req.line, req.action === 'done');
    } catch (err) {
      throw new QuickError('stale', (err as Error).message);
    }
    next = flipped.raw;
    line = flipped.line;
    const label = req.line.replace(/^\d+\. /, '').replace(/^~~|~~ · \*\*done\*\*$/g, '').split(' · ')[0];
    summary = `${label}: ${req.action === 'done' ? 'logged as done' : 'marked not done'}`;
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

  /* The gate: the edited file must still be a file the sync accepts, and
     must still land in the table we think we are editing. */
  let parsed;
  try {
    parsed = parseFile(path, next);
  } catch (err) {
    throw new QuickError('invalid-result', `edit would break the file: ${(err as Error).message}`);
  }
  if (!parsed || parsed.ignored || parsed.table !== spec.table) {
    throw new QuickError('invalid-result', `${path} is not a ${req.target} file`);
  }

  const source = parsed.row as Record<string, unknown>;
  const row: Record<string, unknown> = {};
  for (const c of spec.columns) row[c] = source[c] ?? null;

  return { raw: next, changed: next !== raw, row, summary, undo, line };
}
