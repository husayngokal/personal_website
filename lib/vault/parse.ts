/*
 * Vault file parser — converts an Obsidian .md file (path + raw content)
 * into a typed { table, row } pair that the syncer upserts to Postgres.
 *
 * Each content type has its own parser. Path determines the dispatch:
 *
 *   notebook/threads/*.md           → notebook_threads
 *   notebook/*.md                   → notebook_posts
 *   library/*.md                    → library_books
 *   projects/*.md                   → projects
 *   mental-models/*.md              → mental_models
 *   study/credentials/*.md          → study_credentials
 *   study/domains/*.md              → study_domains
 *   life/motto.md                   → life_motto       (single active row)
 *   life/story/*.md                 → life_story_vignettes
 *   life/principles/*.md            → life_principles
 *   life/journey/*.md               → life_journey_entries
 *   life/goals/*.md                 → life_goals
 *   life/changed-my-mind/*.md       → life_changed_mind
 *   life/master-plan/NN-*.md        → life_master_plan
 *   tasks/*.md                      → tasks  (public accountability)
 *   ideas/*.md                      → ideas  (proposals for the site itself)
 *
 * publications.md and conferences.md are skipped — they don't change
 * often and live in lib/data for now (see vault-repo memory note).
 *
 * Parsing failures throw a ParseError with the file path; the syncer
 * catches and surfaces them to a vault-warnings/ folder.
 */

import matter from 'gray-matter';
import { basename } from 'node:path';
import { sections, bullets } from './sections';

export class ParseError extends Error {
  constructor(public path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ParseError';
  }
}

export interface ParsedFile {
  table: string;
  row: Record<string, unknown>;
  slug: string;        // for logging
  /** Raw post-frontmatter markdown body, kept for wikilink extraction
   *  in the syncer. Empty for non-textual rows (e.g. life/motto). */
  bodyText: string;
  ignored?: boolean;   // file is a known-skip (publications/conferences/README)
}

const SKIP_BASENAMES = new Set(['README.md', 'study/publications.md', 'study/conferences.md']);

export function parseFile(relPath: string, content: string): ParsedFile | null {
  if (SKIP_BASENAMES.has(relPath) || SKIP_BASENAMES.has(basename(relPath))) {
    return { table: '', row: {}, slug: relPath, bodyText: '', ignored: true };
  }
  if (!relPath.endsWith('.md')) return null;

  const parsed = matter(content);
  const fm = parsed.data as Record<string, unknown>;
  const body = parsed.content.trim();
  /* `rawSlug` keeps the original filename punctuation (e.g. trailing
     `?` in "leave-my-city?") so titleFromSlug can preserve it. `slug`
     is the URL-safe form used for the DB key + routing — strips
     characters reserved in URLs that would otherwise break links. */
  const rawSlug = basename(relPath, '.md');
  const slug    = sanitizeSlug(rawSlug);
  /* Rebind wrap() to close over this file's body so every returned
     ParsedFile carries bodyText for downstream wikilink scanning. */
  wrap = (table, s, row) => ({ table, slug: s, row, bodyText: body });

  /* ---- Notebook threads ---- */
  if (relPath.startsWith('notebook/threads/')) {
    return wrap('notebook_threads', slug, {
      slug,
      name:    requireStr(fm, 'name', relPath),
      summary: body || requireStr(fm, 'summary', relPath),
      state:   pick(fm, 'state', ['active', 'dormant', 'concluded'], relPath),
    });
  }

  /* ---- Notebook posts ---- */
  if (relPath.startsWith('notebook/') && !relPath.includes('/threads/')) {
    /* `type:` is technically required but the templates leave it blank
       sometimes; default to 'note' rather than block sync so a single
       missing field doesn't poison the whole notebook upsert. */
    const typeStr = strOrNull(fm.type)?.trim();
    const kind: 'essay' | 'note' =
      typeStr === 'essay' || typeStr === 'note' ? typeStr : 'note';
    /* Always compute word_count from body so it stays accurate as the
       post grows. The frontmatter `word-count` field is ignored if
       present (it would drift). */
    const word_count = wordsIn(body);
    /* Title falls back to a slug-derived title when frontmatter is
       blank — common in author's workflow of dropping notes fast and
       relying on filename to carry the title. We derive from rawSlug
       (the un-sanitised filename) so punctuation like a trailing `?`
       survives into the rendered title. Same for date (today). */
    const title = strOrNull(fm.title)?.trim() || titleFromSlug(rawSlug);
    const date  = strOrNull(fm.date) || new Date().toISOString().slice(0, 10);
    return wrap('notebook_posts', slug, {
      slug,
      kind,
      title,
      dek:   strOrNull(fm.dek),
      date,
      updated: strOrNull(fm.updated),   // optional — author sets when revising
      thread: strOrNull(fm.thread),
      tags:  arrOrNull(fm.tags),
      epistemic_status: strOrNull(fm['epistemic-status']),
      draft: fm.draft === true,
      word_count,
      body,
    });
  }

  /* ---- Library books ---- */
  if (relPath.startsWith('library/')) {
    const secs = sections(body);
    const passages = parsePassages(secs.passages);
    const row: Record<string, unknown> = {
      slug,
      title:  requireStr(fm, 'title', relPath),
      author: requireStr(fm, 'author', relPath),
      isbn:   strOrNull(fm.isbn),
      status: pick(fm, 'status',
        ['planned','reading','finished','abandoned','re-reading','wishlist'], relPath),
      year:   numOrNull(fm.year) ?? 2026,
      started:  strOrNull(fm.started),
      finished: strOrNull(fm.finished),
      rating:   numOrNull(fm.rating),
      genre:    arrOrNull(fm.genre),
      language: strOrNull(fm.language),
      source:   strOrNull(fm.source),
      progress_pct: numOrNull(fm['progress-pct']),
      notes:  secs.notes  || null,
      review: secs.review || null,
      passages,
    };
    /* Manual cover override — only included when the frontmatter
       carries it, so the auto-probed Open Library URL stored by
       sync.ts isn't clobbered to null on routine re-syncs. */
    if (fm['cover-url'] !== undefined) {
      row.cover_url = strOrNull(fm['cover-url']);
    }
    return wrap('library_books', slug, row);
  }

  /* ---- Projects ---- */
  if (relPath.startsWith('projects/')) {
    const secs = sections(body);
    const currentState = secs['current state'] || null;
    const stuckOn = bullets(secs['currently stuck on']);
    const decisions = parseDecisions(secs.decisions);
    return wrap('projects', slug, {
      slug,
      title:   requireStr(fm, 'title', relPath),
      tagline: requireStr(fm, 'tagline', relPath),
      status:  pick(fm, 'status',
        ['active','paused','dormant','concluded','shipped','dead'], relPath),
      started: strOrNull(fm.started),
      ended:   strOrNull(fm.ended),
      tags:    arrOrNull(fm.tags),
      repo:    strOrNull(fm.repo),
      repo_private: fm['repo-private'] === true,
      external_url: strOrNull(fm['external-url']),
      last_active:  requireStr(fm, 'last-active', relPath),
      current_state: currentState,
      stuck_on: stuckOn.length > 0 ? stuckOn : null,
      tasks: (fm.tasks as object) ?? null,
      activity: (fm.activity as object) ?? null,
      decisions: decisions && decisions.length > 0 ? decisions : null,
    });
  }

  /* ---- Mental models ---- */
  if (relPath.startsWith('mental-models/')) {
    const secs = sections(body);
    return wrap('mental_models', slug, {
      slug,
      title:   requireStr(fm, 'title', relPath),
      origin:  strOrNull(fm.origin),
      type:    pick(fm, 'type', ['curated','original','hybrid'], relPath),
      related: arrOrNull(fm.related),
      tags:    arrOrNull(fm.tags),
      last_reviewed: strOrNull(fm['last-reviewed']),
      depth:   strOrNull(fm.depth),
      one_line: requireStr(fm, 'one-line', relPath),
      body:    secs['the model']      || null,
      framing: secs["husayn's framing"]|| secs['husayns framing'] || null,
      when_to_reach: nonEmpty(bullets(secs['when to reach for it'])),
      when_not_to:   nonEmpty(bullets(secs['when not to'])),
      in_the_wild:   (fm['in-the-wild'] as object) ?? null,
      sources:       parseSources(secs.sources),
      changed_my_mind: (fm['changed-my-mind'] as object) ?? null,
    });
  }

  /* ---- Study credentials ---- */
  if (relPath.startsWith('study/credentials/')) {
    const secs = sections(body);
    return wrap('study_credentials', slug, {
      slug,
      title:    requireStr(fm, 'title', relPath),
      full_title: strOrNull(fm['full-title']),
      institution: requireStr(fm, 'institution', relPath),
      earned:   strOrNull(fm.earned),
      pending:  fm.pending === true,
      expires:  strOrNull(fm.expires),
      exam_date: strOrNull(fm['exam-date']),
      depth:    pick(fm, 'depth',
        ['dabbled','learning','working-in','teaching-from','decayed'], relPath),
      last_assessed: requireStr(fm, 'last-assessed', relPath),
      tags:     arrOrNull(fm.tags),
      what_stuck: secs['what stuck'] || '',
      what_didnt: secs["what didn't"] || secs['what didnt'] || '',
      sources:  (fm.sources as object) ?? null,
    });
  }

  /* ---- Study domains ---- */
  if (relPath.startsWith('study/domains/')) {
    return wrap('study_domains', slug, {
      slug,
      title: requireStr(fm, 'title', relPath),
      depth: pick(fm, 'depth',
        ['dabbled','learning','working-in','teaching-from','decayed'], relPath),
      body,
    });
  }

  /* ---- Credentials — publicly downloadable academic + professional
     documents (transcripts, diplomas, certificates, letters). The
     file itself lives in R2 (media.husayngokal.com); this entry
     carries the metadata + the relative path the page resolves
     against NEXT_PUBLIC_VAULT_MEDIA_URL. ---- */
  if (relPath.startsWith('credentials/')) {
    return wrap('credentials', slug, {
      slug,
      title:           strOrNull(fm.title)?.trim() || titleFromSlug(rawSlug),
      institution:     strOrNull(fm.institution),
      year:            numOrNull(fm.year),
      type:            pick(fm, 'type',
        ['transcript','diploma','certificate','letter','other'], relPath),
      /* file is optional — LinkedIn-imported certifications, for
         example, have only a verification URL and no downloadable PDF.
         Detail page renders the verify link as the primary CTA when
         no file is present. */
      file_path:       strOrNull(fm.file),
      date_issued:     strOrNull(fm['date-issued']),
      description:     strOrNull(fm.description),
      verification_url: strOrNull(fm['verification-url']),
      is_public:       fm.public !== false,    // defaults to true
      body:            body || null,
    });
  }

  /* ---- Writeups — unified surface for both machine writeups
     (kind=machine: HackTheBox, TryHackMe, CTFs) AND technique notes
     (kind=technique: tool references, methodology, concepts). The
     box-specific fields are required only when kind=machine; for
     techniques they're all optional. ---- */
  if (relPath.startsWith('writeups/')) {
    const title = strOrNull(fm.title)?.trim() || titleFromSlug(rawSlug);
    /* Heuristic default: if `platform:` is present, treat as a
       machine writeup; otherwise it's a technique. The author can
       still override explicitly via `kind: machine | technique`. */
    const kindFm = strOrNull(fm.kind);
    const kind: 'machine' | 'technique' =
      kindFm === 'machine' || kindFm === 'technique'
        ? kindFm
        : (fm.platform ? 'machine' : 'technique');

    const row: Record<string, unknown> = {
      slug,
      title,
      kind,
      category:   strOrNull(fm.category),
      date:       strOrNull(fm.date),
      tags:       arrOrNull(fm.tags),
      techniques: arrOrNull(fm.techniques),
      body:       body || null,
    };

    if (kind === 'machine') {
      row.platform   = pick(fm, 'platform',
        ['htb','thm','vulnhub','portswigger','ctf','other'], relPath);
      row.status     = pick(fm, 'status',
        ['rooted','foothold','attempted','abandoned'], relPath);
      row.difficulty = strOrNull(fm.difficulty);
      row.os         = strOrNull(fm.os);
      row.points     = numOrNull(fm.points);
      row.ip         = strOrNull(fm.ip);
    } else {
      /* technique — accept these only if present, never required */
      const platform = strOrNull(fm.platform);
      if (platform) row.platform = platform;
    }
    return wrap('writeups', slug, row);
  }

  /* ---- Courses (university curriculum) ---- */
  if (relPath.startsWith('courses/')) {
    return wrap('courses', slug, {
      slug,
      code:       strOrNull(fm.code),
      title:      requireStr(fm, 'title', relPath),
      university: requireStr(fm, 'university', relPath),
      department: strOrNull(fm.department),
      banner_image: strOrNull(fm['banner-image']),
      source_url:   strOrNull(fm['source-url']),
      video_url:    strOrNull(fm['video-url']),
      professors: arrOrNull(fm.professors),
      textbooks: (fm.textbooks as object) ?? null,
      prerequisites: arrOrNull(fm.prerequisites),
      est_total_hours: numOrNull(fm['est-total-hours']),
      weekly_hours: numOrNull(fm['weekly-hours']),
      syllabus: (fm.syllabus as object) ?? null,
      status: pick(fm, 'status',
        ['planned','studying','completed','abandoned'], relPath),
      started: strOrNull(fm.started),
      finished: strOrNull(fm.finished),
      order_: numOrNull(fm.order) ?? 0,
      tags: arrOrNull(fm.tags),
      body: body || null,
    });
  }

  /* ---- Ideas — proposal log for the website itself + adjacent
     projects. status open / exploring / building / shipped / dropped. ---- */
  if (relPath.startsWith('ideas/')) {
    return wrap('ideas', slug, {
      slug,
      title:    requireStr(fm, 'title', relPath),
      summary:  requireStr(fm, 'summary', relPath),
      status:   pick(fm, 'status',
        ['open','exploring','building','shipped','dropped'], relPath),
      proposed: requireStr(fm, 'proposed', relPath),
      tags:     arrOrNull(fm.tags),
      body:     body || null,
      shipped_as: strOrNull(fm['shipped-as']),
    });
  }

  /* ---- Public tasks ---- */
  if (relPath.startsWith('tasks/')) {
    /* Slug from frontmatter wins so files inside subfolders (e.g.
       tasks/artifacts/sw-01-developer-os.md) get a clean URL slug
       rather than the nested path. Falls back to filename. */
    const taskSlug = strOrNull(fm.slug) || slug;
    /* Only include recurrence / category in the row payload when
       the frontmatter actually has them. This keeps the upsert
       compatible with the table before migration 0012 has been run
       — PostgREST rejects unknown columns, so silently emitting
       `recurrence: null` would break sync for the 100+ task files
       on a database that's still on the 0011 schema. */
    const row: Record<string, unknown> = {
      slug: taskSlug,
      title:     requireStr(fm, 'title', relPath),
      status:    pick(fm, 'status',
        ['open','in-progress','done','dropped','blocked'], relPath),
      scope:     pick(fm, 'scope',
        ['today','this-week','this-month','this-quarter','this-year','lifetime'], relPath),
      priority:  numOrNull(fm.priority),
      project:   strOrNull(fm.project),
      due:       strOrNull(fm.due),
      completed: strOrNull(fm.completed),
      notes:     body || null,
      ordinal:   numOrNull(fm.ordinal),
    };
    if (fm.recurrence) {
      row.recurrence = pick(fm, 'recurrence',
        ['daily','weekly','monthly','quarterly','yearly'], relPath);
    }
    if (fm.category) {
      row.category = String(fm.category);
    }
    return wrap('tasks', taskSlug, row);
  }

  /* ---- Life: master plan parts ---- */
  if (relPath.startsWith('life/master-plan/')) {
    /* Filename: 01-master-architecture.md → partNumber=1, slug=master-architecture */
    const m = slug.match(/^(\d+)-(.+)$/);
    const partNumber = m ? Number(m[1]) : (numOrNull(fm.part) ?? 0);
    const realSlug = m ? m[2] : (strOrNull(fm.slug) ?? slug);
    return wrap('life_master_plan', realSlug, {
      slug: realSlug,
      part_number: partNumber,
      title: requireStr(fm, 'title', relPath),
      body,
      summary: strOrNull(fm.summary),
    });
  }

  /* ---- Life: motto (single-active-row) ---- */
  if (relPath === 'life/motto.md') {
    return wrap('life_motto', 'motto', {
      text: body,
      language: strOrNull(fm.language) || 'en',
      active: true,
    });
  }

  /* ---- Life: story vignettes ---- */
  if (relPath.startsWith('life/story/')) {
    /* Filename: 00-the-deep-work-discovery.md */
    const m = slug.match(/^(\d+)-(.+)$/);
    const ordinal = m ? Number(m[1]) : (numOrNull(fm.ordinal) ?? 0);
    const realSlug = m ? m[2] : slug;
    return wrap('life_story_vignettes', realSlug, {
      slug: realSlug,
      title: requireStr(fm, 'title', relPath),
      body,
      ordinal,
    });
  }

  /* ---- Life: principles ---- */
  if (relPath.startsWith('life/principles/')) {
    /* Body format: manifesto\n\n---\n\nbody */
    const [manifesto, ...rest] = body.split(/\n+---\n+/);
    const explanationBody = rest.join('\n---\n').trim() || null;
    return wrap('life_principles', slug, {
      slug,
      title:    requireStr(fm, 'title', relPath),
      order_:   numOrNull(fm.order) ?? 0,
      manifesto: manifesto.trim(),
      body:     explanationBody,
      established: strOrNull(fm.established),
      revised:  strOrNull(fm.revised),
      tags:     arrOrNull(fm.tags),
    });
  }

  /* ---- Life: journey entries ---- */
  if (relPath.startsWith('life/journey/')) {
    const m = slug.match(/^(\d+)-(.+)$/);
    const ordinal = m ? Number(m[1]) : (numOrNull(fm.ordinal) ?? 0);
    return wrap('life_journey_entries', slug, {
      /* id auto-generated */
      date:  requireStr(fm, 'date', relPath),
      title: requireStr(fm, 'title', relPath),
      reflection: body || null,
      ordinal,
    });
  }

  /* ---- Life: goals ---- */
  if (relPath.startsWith('life/goals/')) {
    return wrap('life_goals', slug, {
      slug,
      scale:  pick(fm, 'scale',
        ['lifetime','five-year','this-year','this-quarter','this-month'], relPath),
      year:   numOrNull(fm.year),
      title:  requireStr(fm, 'title', relPath),
      status: pick(fm, 'status',
        ['completed','partially-completed','dropped','rolled-over','in-progress','planned'], relPath),
      note:   body || null,
    });
  }

  /* ---- Comment moderation queue (BRIEF Part XIII) ----
     The /submissions/{id}.md files mirror the comments table for
     Obsidian-side moderation. The vault is the editing surface; the
     DB is the source of truth. The syncer upserts on the `id` PK so
     status flips ('pending' → 'accepted' | 'rejected') round-trip
     cleanly. The body field is the comment body; everything else is
     frontmatter. */
  if (relPath.startsWith('submissions/')) {
    /* Skip README and any non-comment housekeeping files. The real
       moderation files are UUID-named and carry the full frontmatter. */
    if (basename(relPath) === 'README.md' || !fm.id) {
      return { table: '', row: {}, slug: relPath, bodyText: '', ignored: true };
    }
    const id     = requireStr(fm, 'id', relPath);
    const post   = requireStr(fm, 'post', relPath);
    const email  = requireStr(fm, 'email', relPath);
    const status = pick(fm, 'status', ['pending','accepted','rejected'], relPath);
    /* We deliberately do NOT include reviewed_at in the row — the DB
       column stays whatever it already was (NULL on first submission,
       set later if author manually sets `reviewed-at` in frontmatter).
       ReaderNotes falls back to created_at for display when null,
       which is the meaningful date anyway (when the reader wrote it). */
    const row: Record<string, unknown> = {
      id,
      post_slug: post,
      body: body,
      email,
      name: strOrNull(fm.name),
      status,
    };
    const reviewedAt = strOrNull(fm['reviewed-at']);
    if (reviewedAt) row.reviewed_at = reviewedAt;
    return wrap('comments', id, row);
  }

  /* ---- Life: changed-my-mind ---- */
  if (relPath.startsWith('life/changed-my-mind/')) {
    const secs = sections(body);
    return wrap('life_changed_mind', slug, {
      slug,
      title: requireStr(fm, 'title', relPath),
      date_changed: requireStr(fm, 'date-changed', relPath),
      previous: secs.previously || '',
      next_:    secs.now || '',
      tags: arrOrNull(fm.tags),
    });
  }

  /* Unknown path → skip silently. Lets non-content files (templates,
     attachments, scratchpads) live in the vault without interference. */
  return null;
}

/* -- Helpers ------------------------------------------------------- */
/* `wrap` is reassigned per call to close over the current file's body
   so every returned ParsedFile carries bodyText without threading it
   through every branch's call site. */
let wrap = (_table: string, _slug: string, _row: Record<string, unknown>): ParsedFile => {
  throw new Error('wrap() called outside parseFile()');
};

function requireStr(fm: Record<string, unknown>, key: string, path: string): string {
  const v = fm[key];
  if (v instanceof Date) return formatDate(v);
  if (typeof v !== 'string' && typeof v !== 'number') {
    throw new ParseError(path, `missing required frontmatter field '${key}'`);
  }
  return String(v);
}

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return formatDate(v);
  return String(v);
}

/* js-yaml (the YAML parser gray-matter uses) auto-converts ISO date
   strings into JS Date objects. Postgres date columns then choke on the
   timezone suffix when we serialize back with String(date). Always
   normalise dates to YYYY-MM-DD (UTC) for round-trip safety. */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function arrOrNull(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  return v.map(String);
}

function pick<T extends string>(
  fm: Record<string, unknown>, key: string, allowed: readonly T[], path: string,
): T {
  const v = fm[key];
  if (typeof v !== 'string') {
    throw new ParseError(path, `missing required frontmatter field '${key}'`);
  }
  if (!allowed.includes(v as T)) {
    throw new ParseError(path,
      `'${key}' must be one of ${allowed.join('|')}, got '${v}'`);
  }
  return v as T;
}

function nonEmpty<T>(arr: T[]): T[] | null {
  return arr.length > 0 ? arr : null;
}

/* Approximate word count — splits on whitespace runs, strips empty strings.
   Good enough for "currently writing X — N words and growing." */
function wordsIn(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/* Filename-as-title fallback: `transferring-files` → `Transferring Files`.
   Used when frontmatter `title:` is blank so the author's habit of dropping
   notes fast (relying on filename to carry the title) doesn't block sync.
   Punctuation in the filename survives (`leave-my-city?` → `Leave My City?`). */
function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/* URL-safe slug derivation from a raw filename. The vault is allowed to
   carry expressive filenames ("why-cities?", "leave-my-city?") but the
   `?` in particular breaks URL routing (it's the query-string separator).
   We strip the URL-reserved characters and collapse runs of separators
   into a single hyphen. Title derivation uses the rawSlug so the
   punctuation survives in the rendered title — only the slug is sanitised. */
function sanitizeSlug(s: string): string {
  return s
    /* URL-reserved + general nuisance chars. Keeps unicode letters intact
       (Next.js handles them in routes; encodes at request time). */
    .replace(/[?#&%/\\:*<>"|\s]+/g, '-')
    /* Collapse repeated hyphens introduced above. */
    .replace(/-+/g, '-')
    /* Trim leading / trailing hyphens. */
    .replace(/^-+|-+$/g, '');
}

function parsePassages(text: string | undefined) {
  if (!text) return null;
  /* Block-quote passages: > text\n>\n> *p.N* */
  const parts = text.split(/\n\n/);
  const out: { text: string; page?: string }[] = [];
  for (const p of parts) {
    const lines = p.split('\n').filter((l) => l.startsWith('>'));
    if (lines.length === 0) continue;
    const text = lines
      .filter((l) => !/\*p\.\d+\*/.test(l))
      .map((l) => l.replace(/^>\s?/, '').trim())
      .filter(Boolean).join(' ');
    const pageMatch = lines.join(' ').match(/\*p\.([0-9a-z]+)\*/i);
    out.push({ text, page: pageMatch?.[1] });
  }
  return out.length > 0 ? out : null;
}

function parseDecisions(text: string | undefined) {
  if (!text) return null;
  /* Each decision is `### YYYY-MM-DD — title\n\nbody` */
  const re = /###\s+([0-9-]+)\s+—\s+([^\n]+)\n+([\s\S]*?)(?=\n###\s+|$)/g;
  const out: { date: string; title: string; body: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ date: m[1].trim(), title: m[2].trim(), body: m[3].trim() });
  }
  return out;
}

function parseSources(text: string | undefined) {
  if (!text) return null;
  const out: { href?: string; label: string }[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-')) continue;
    const content = trimmed.replace(/^-\s+/, '');
    const linked = content.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linked) out.push({ label: linked[1], href: linked[2] });
    else out.push({ label: content });
  }
  return out.length > 0 ? out : null;
}
