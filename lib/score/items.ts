/*
 * Vault files -> scored items.
 *
 * Reads every file the same way the sync does (through the real parser,
 * so titles, slugs and statuses match the database exactly) and turns each
 * scoreable one into an item: its lane, whether it is on the plate right
 * now, its parts and repeatables, and the dated events they produced.
 *
 * An item scores from its `score:` block (block.ts). A few kinds score
 * without one, from rules.ts defaults: a plain task (gut hours by scope),
 * a published essay or writeup (by length), a Field Atlas outing (route
 * time, frozen into the line when logged).
 *
 * Pure module, no I/O.
 */

import matter from 'gray-matter';
import { parseFile } from '../vault/parse';
import { listDoneItems } from '../vault/done-items';
import {
  DEFAULT_LANE, RECURRING_GUT_HOURS, SCOPE_WEEKS, SCORE_EPOCH, TASK_GUT_HOURS, atlasPoints, estimate,
  type Lane, type TemplateId,
} from './rules';
import { parseDone, readBlock, type PartGroup, type RepeatGroup, type ScoreBlock } from './block';
import { parseSessions, type Session } from './time';

export type Surface =
  | 'tasks' | 'library' | 'courses' | 'exams' | 'projects'
  | 'atlas' | 'list' | 'notebook' | 'writeups';

export interface ScoreEvent {
  date: string;
  points: number;
  lane: Lane;
  kind: 'part' | 'repeat' | 'outcome';
  key: string;
  surface: Surface;
  label: string;
}

export interface ScoreItem {
  key: string;              // vault path
  table: string;
  surface: Surface;
  slug: string;
  title: string;
  href: string | null;
  lane: Lane;
  active: boolean;          // on the plate right now
  parked: boolean;          // taken off the plate by its score block
  private: boolean;
  hasBlock: boolean;
  needsSetup: TemplateId | null;
  parts: PartGroup[];
  repeat: RepeatGroup[];
  outcome: { points: number; achieved: string | null } | null;
  weeklyHours: number | null;
  deadline: string | null;
  events: ScoreEvent[];
}

export interface Tally { done: number; total: number }

export interface Extracted {
  items: ScoreItem[];
  tallies: { tasks: Tally; atlas: Tally; list: Tally };
  sessions: Session[];
}

export interface VaultSource { path: string; content: string }

const ACTIVE_TASK = new Set(['open', 'in-progress', 'blocked']);

function day(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
}

function surfaceOf(path: string): Surface | null {
  if (path.startsWith('tasks/')) return 'tasks';
  if (path.startsWith('library/')) return 'library';
  if (path.startsWith('courses/')) return 'courses';
  if (path.startsWith('study/credentials/')) return 'exams';
  if (path.startsWith('projects/')) return 'projects';
  if (path.startsWith('notebook/') && !path.includes('/threads/')) return 'notebook';
  if (path.startsWith('writeups/')) return 'writeups';
  return null;
}

function hrefFor(surface: Surface, slug: string): string {
  switch (surface) {
    case 'tasks': return `/life/tasks#${slug}`;
    case 'library': return `/library/${slug}`;
    case 'courses': return `/courses/${slug}`;
    case 'exams': return `/study/credentials/${slug}`;
    case 'projects': return `/projects/${slug}`;
    case 'notebook': return `/notebook/${slug}`;
    case 'writeups': return `/writeups/${slug}`;
    case 'atlas': return '/field-atlas';
    case 'list': return '/bucket-list';
  }
}

/** Points a part-group event is worth. Cumulative rounding, so the parts
 *  of a group always add up to exactly its total. */
function partEvents(item: Omit<ScoreItem, 'events'>, g: PartGroup): ScoreEvent[] {
  const entries = g.done
    .map(parseDone)
    .filter((e): e is NonNullable<typeof e> => !!e)
    .sort((a, b) => a.date.localeCompare(b.date));
  const out: ScoreEvent[] = [];
  let n = g.prior;
  for (const e of entries) {
    if (n >= g.count) break;
    const before = n;
    n = Math.min(g.count, n + e.qty);
    const points = Math.round((g.points * n) / g.count) - Math.round((g.points * before) / g.count);
    const what = n - before > 1 ? `${n - before} ${plural(g.unit)}` : g.unit;
    out.push({
      date: e.date, points, lane: item.lane, kind: 'part', key: item.key, surface: item.surface,
      label: `${item.title} · ${g.name ? `${g.name} · ` : ''}${what}`,
    });
  }
  return out;
}

function repeatEvents(item: Omit<ScoreItem, 'events'>, g: RepeatGroup): ScoreEvent[] {
  return g.done
    .map(parseDone)
    .filter((e): e is NonNullable<typeof e> => !!e)
    .map((e) => ({
      date: e.date, points: g.points * e.qty, lane: item.lane, kind: 'repeat' as const,
      key: item.key, surface: item.surface, label: `${item.title} · ${g.unit}`,
    }));
}

export function plural(unit: string): string {
  if (/(s|x|ch|sh)$/.test(unit)) return `${unit}es`;
  if (/[^aeiou]y$/.test(unit)) return `${unit.slice(0, -1)}ies`;
  return `${unit}s`;
}

export { atlasPoints } from './rules';

function fromFile(src: VaultSource): ScoreItem | null {
  const surface = surfaceOf(src.path);
  if (!surface) return null;
  let parsed;
  try {
    parsed = parseFile(src.path, src.content);
  } catch {
    return null;                       // the sync reports parse errors
  }
  if (!parsed || parsed.ignored || !parsed.table) return null;
  const fm = matter(src.content).data as Record<string, unknown>;
  const row = parsed.row as Record<string, unknown>;
  const block: ScoreBlock | null = readBlock(fm);

  const isPrivate = fm.private === true;
  const title = isPrivate ? 'Private task' : String(row.title ?? parsed.slug);
  const base: Omit<ScoreItem, 'events'> = {
    key: src.path,
    table: parsed.table,
    surface,
    slug: parsed.slug,
    title,
    href: isPrivate ? null : hrefFor(surface, parsed.slug),
    lane: block?.lane ?? DEFAULT_LANE[surface] ?? 'curiosity',
    active: false,
    parked: block?.parked === true,
    private: isPrivate,
    hasBlock: !!block,
    needsSetup: null,
    parts: block?.parts ?? [],
    repeat: block?.repeat ?? [],
    outcome: block?.outcome ? { points: block.outcome, achieved: null } : null,
    weeklyHours: block?.weeklyHours ?? null,
    deadline: null,
  };

  switch (surface) {
    case 'tasks': {
      base.active = ACTIVE_TASK.has(String(row.status)) && row.scope !== 'lifetime';
      base.deadline = day(row.due);
      if (block) {
        /* A sized task finished by its status (Done in Quick, the edit form,
           Obsidian): its single part counts as done on the completed day. */
        const g = block.parts.length === 1 ? block.parts[0] : null;
        const completed = day(row.completed);
        if (g && g.count === 1 && g.done.length === 0 && g.prior === 0 && row.status === 'done' && completed) {
          base.parts = [{ ...g, done: [completed] }];
        }
      } else {
        const rec = typeof row.recurrence === 'string' ? row.recurrence : null;
        if (rec) {
          base.repeat = [{ unit: 'occurrence', points: estimate.gut(RECURRING_GUT_HOURS[rec] ?? 1), done: [] }];
        } else {
          const completed = row.status === 'done' ? day(row.completed) : null;
          base.parts = [{
            unit: 'task', count: 1,
            points: estimate.gut(TASK_GUT_HOURS[String(row.scope)] ?? 4),
            prior: row.status === 'done' && !completed ? 1 : 0,
            done: completed ? [completed] : [],
          }];
        }
      }
      /* Hours a week while active: the item's own figure, or its estimate
         spread over the weeks its scope spans (a this-week task takes its
         whole estimate this week; a this-quarter one a thirteenth). */
      if (base.active && base.weeklyHours === null) {
        const pts = base.parts.reduce((n, g) => n + g.points, 0) || base.repeat.reduce((n, g) => n + g.points, 0);
        const h = pts / 4 / (SCOPE_WEEKS[String(row.scope)] ?? 4);
        base.weeklyHours = Math.round(h * 10) / 10;
      }
      break;
    }
    case 'library':
      base.active = row.status === 'reading' || row.status === 're-reading';
      if (base.active && !block) base.needsSetup = 'book';
      break;
    case 'courses':
      base.active = row.status === 'studying';
      if (base.active && !block) base.needsSetup = 'course';
      break;
    case 'exams': {
      const pending = row.pending === true;
      base.deadline = day(row.exam_date);
      base.active = pending && (!!base.deadline || !!block);
      if (base.active && !block) base.needsSetup = 'exam-prep';
      if (base.outcome) base.outcome.achieved = !pending ? day(row.earned) : null;
      break;
    }
    case 'projects':
      base.active = row.status === 'active';
      if (base.active && !block) base.needsSetup = 'task';
      break;
    case 'notebook':
    case 'writeups': {
      /* Scores once, on the date it went out, by length. Only an explicit
         frontmatter date counts: the parser falls back to "today" for an
         undated essay, which would move its points every week. */
      const published = day(fm.date);
      if (surface === 'notebook' && row.draft === true) break;
      if (published && !block) {
        const words = String(parsed.bodyText || '').split(/\s+/).filter(Boolean).length;
        base.parts = [{ unit: surface === 'notebook' ? 'essay' : 'writeup', count: 1, points: estimate.words(words), prior: 0, done: [published] }];
      }
      break;
    }
  }

  /* Parked: off the plate. An exam stays parked whatever its status says
     (its status is someone else's fact). Anything else that has since been
     made current again by hand (status edited back) counts as active; the
     stale flag is ignored. */
  if (base.parked) {
    if (surface === 'exams' || !base.active) { base.active = false; base.needsSetup = null; }
    else base.parked = false;
  }

  const events: ScoreEvent[] = [];
  for (const g of base.parts) events.push(...partEvents(base, g));
  for (const g of base.repeat) events.push(...repeatEvents(base, g));
  if (base.outcome?.achieved) {
    events.push({
      date: base.outcome.achieved, points: base.outcome.points, lane: base.lane, kind: 'outcome',
      key: base.key, surface, label: `${title} · result`,
    });
  }
  return { ...base, events };
}

function atlasItem(src: VaultSource, tallies: Extracted['tallies']): ScoreItem | null {
  let body: string;
  try {
    body = matter(src.content).content;
  } catch {
    return null;
  }
  const groups = listDoneItems(body);
  const events: ScoreEvent[] = [];
  let done = 0, total = 0;
  for (const g of groups) {
    for (const i of g.items) {
      total++;
      if (!i.done) continue;
      done++;
      if (!i.date) continue;
      events.push({
        date: i.date,
        points: i.points ?? atlasPoints(i.text, g.heading),
        lane: DEFAULT_LANE.atlas, kind: 'part', key: src.path, surface: 'atlas',
        label: `Field Atlas · ${i.text.split(' · ')[0]}`,
      });
    }
  }
  tallies.atlas = { done, total };
  return {
    key: src.path, table: 'living_entries', surface: 'atlas', slug: 'field-atlas',
    title: 'The Field Atlas', href: '/field-atlas', lane: DEFAULT_LANE.atlas,
    active: false, parked: false, private: false, hasBlock: false, needsSetup: null,
    parts: [], repeat: [], outcome: null, weeklyHours: null, deadline: null, events,
  };
}

/* The List: "**N. Title**" headings; an item is done once its heading is
   struck through or carries a done mark. Stages per item come later. */
function listTally(src: VaultSource): Tally {
  let body = '';
  try { body = matter(src.content).content; } catch { /* empty */ }
  let done = 0, total = 0;
  for (const line of body.split(/\r?\n/)) {
    if (!/^\*\*\d+\.\s/.test(line)) continue;
    total++;
    if (/~~|\*\*done/.test(line)) done++;
  }
  return { done, total };
}

/** One file as a scored item (null if it is not a scoreable kind). */
export function itemFromFile(src: VaultSource): ScoreItem | null {
  return fromFile(src);
}

/** The block an item effectively scores from: its own, or the one the
 *  defaults imply (a plain or recurring task). Logging into it freezes
 *  those defaults into the file. */
export function effectiveBlock(item: ScoreItem): ScoreBlock {
  return {
    lane: item.lane,
    weeklyHours: item.weeklyHours ?? undefined,
    outcome: item.outcome?.points,
    parts: item.parts.map((g) => ({ ...g, done: [...g.done] })),
    repeat: item.repeat.map((g) => ({ ...g, done: [...g.done] })),
  };
}

export function extractAll(files: VaultSource[]): Extracted {
  const tallies: Extracted['tallies'] = {
    tasks: { done: 0, total: 0 }, atlas: { done: 0, total: 0 }, list: { done: 0, total: 0 },
  };
  const items: ScoreItem[] = [];
  const sessions: Session[] = [];
  for (const f of files) {
    if (!f.path.endsWith('.md')) continue;
    if (f.path.startsWith('time/')) {
      sessions.push(...parseSessions(f.content));
      continue;
    }
    if (f.path === 'living/field-atlas.md') {
      const a = atlasItem(f, tallies);
      if (a) items.push(a);
      continue;
    }
    if (f.path === 'living/bucket-list.md') {
      tallies.list = listTally(f);
      continue;
    }
    const item = fromFile(f);
    if (item) items.push(item);
  }

  /* Current tasks: everything scoped below lifetime that is still live,
     plus what was finished since scoring began. Older finished tasks are
     history, and dropped ones are neither. */
  for (const f of files) {
    if (!f.path.startsWith('tasks/')) continue;
    try {
      const p = parseFile(f.path, f.content);
      const r = p?.row as Record<string, unknown> | undefined;
      if (!r || r.scope === 'lifetime' || r.status === 'dropped') continue;
      if (r.status === 'done') {
        const completed = day(r.completed);
        if (!completed || completed < SCORE_EPOCH) continue;
        tallies.tasks.done++;
      }
      tallies.tasks.total++;
    } catch { /* reported by the sync */ }
  }
  return { items, tallies, sessions };
}
