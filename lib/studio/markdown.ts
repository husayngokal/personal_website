/*
 * Studio markdown builder + validator.
 *
 * Turns a ContentType + submitted values into a vault-ready .md file whose
 * frontmatter matches what lib/vault/parse.ts expects. validate() enforces
 * required fields and select enums server-side, mirroring the parser's pick(),
 * so a bad submission is rejected before it ever reaches the repo.
 */

import matter from 'gray-matter';
import type { ContentType, Field } from './schema';
import { sections as extractSections } from '../vault/sections';

/* Mirrors sanitizeSlug() in lib/vault/parse.ts: lowercase, strip quotes,
   collapse nuisance/space runs to a hyphen, trim. Filenames the parser will
   re-sanitise anyway, but a clean slug keeps the committed path tidy. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['‘’‚‛ʼ′“”„‟"]/g, '')
    .replace(/[?#&%/\\:*<>|!\s]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface Values {
  [key: string]: string | string[] | boolean | number | Record<string, string> | undefined;
  /** freeform body */
  body?: string;
  /** section-mode body: { 'Notes': '...', 'Review': '...' } */
  sections?: Record<string, string>;
}

export function validate(type: ContentType, values: Values): string[] {
  const errors: string[] = [];
  for (const f of type.fields) {
    const raw = values[f.name];
    const empty = raw === undefined || raw === '' || (Array.isArray(raw) && raw.length === 0);
    if (f.required && empty) {
      errors.push(`${f.label} is required`);
      continue;
    }
    if (!empty && f.type === 'select' && f.options && typeof raw === 'string' && !f.options.includes(raw)) {
      errors.push(`${f.label} must be one of ${f.options.join(', ')}`);
    }
  }
  return errors;
}

function coerce(field: Field, raw: Values[string]): unknown {
  switch (field.type) {
    case 'number': {
      if (raw === '' || raw === undefined) return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'boolean':
      return raw === true || raw === 'true';
    case 'tags': {
      if (Array.isArray(raw)) return raw.filter(Boolean);
      if (typeof raw === 'string' && raw.trim()) return raw.split(',').map((s) => s.trim()).filter(Boolean);
      return undefined;
    }
    default: {
      const s = typeof raw === 'string' ? raw.trim() : raw;
      return s === '' ? undefined : s;
    }
  }
}

export interface BuiltFile {
  slug: string;
  path: string;
  content: string;
  url: string;
}

export function buildMarkdown(type: ContentType, values: Values): BuiltFile {
  const titleValue = String(values[type.titleField] ?? '').trim();
  const slug = slugify(titleValue);

  /* Frontmatter: fixed constants first, then each field that has a value.
     Empty optionals are omitted to keep files clean; required emptiness is
     already caught by validate(). */
  const fm: Record<string, unknown> = { ...(type.fixed ?? {}) };
  for (const f of type.fields) {
    const v = coerce(f, values[f.name]);
    if (v !== undefined) fm[f.name] = v;
  }

  let body = '';
  if (type.body.mode === 'freeform') {
    body = (values.body ?? '').toString().trim();
  } else if (type.body.mode === 'sections') {
    body = type.body.sections
      .map((s) => `## ${s}\n\n${(values.sections?.[s] ?? '').toString().trim()}`.trimEnd())
      .join('\n\n');
  } else if (type.body.mode === 'split') {
    /* Parts joined by a horizontal rule, no headings — e.g. a life
       principle's manifesto and its explanation (see parse.ts). */
    body = type.body.parts
      .map((p) => (values.sections?.[p] ?? '').toString().trim())
      .join('\n\n---\n\n')
      .trim();
  }

  /* Filename: NN-slug for numeric-prefixed types (life plan parts, story
     vignettes), otherwise just the slug. */
  let filename = slug;
  if (type.numberPrefix) {
    const n = Number(values[type.numberPrefix.field]);
    const prefix = Number.isFinite(n)
      ? String(n).padStart(type.numberPrefix.pad, '0')
      : '0'.repeat(type.numberPrefix.pad);
    filename = `${prefix}-${slug}`;
  }

  /* gray-matter stringify -> ---\n<yaml>---\n<body>. Trailing newline for
     a tidy diff. */
  const content = matter.stringify(body ? `\n${body}\n` : '\n', fm);
  const path = `${type.folder}/${filename}.md`;
  const url = `${type.route}/${slug}`;
  return { slug, path, content, url };
}

export interface LoadedEntry {
  values: Record<string, string>;
  body: string;
  sections: Record<string, string>;
}

/* Reverse of buildMarkdown: turn an existing .md file into form-ready values
   for the edit flow. Arrays become comma strings, booleans become 'true'/'',
   js-yaml Date objects normalise to YYYY-MM-DD. Body is split back into its
   freeform text / section map / split parts. */
export function parseExisting(type: ContentType, raw: string): LoadedEntry {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  const content = parsed.content.trim();

  const values: Record<string, string> = {};
  for (const f of type.fields) {
    const v = data[f.name];
    if (v === undefined || v === null) values[f.name] = '';
    else if (v instanceof Date) values[f.name] = v.toISOString().slice(0, 10);
    else if (Array.isArray(v)) values[f.name] = v.map(String).join(', ');
    else if (typeof v === 'boolean') values[f.name] = v ? 'true' : '';
    else values[f.name] = String(v);
  }

  let body = '';
  const secs: Record<string, string> = {};
  if (type.body.mode === 'freeform') {
    body = content;
  } else if (type.body.mode === 'sections') {
    const map = extractSections(content);
    for (const s of type.body.sections) secs[s] = map[s.toLowerCase()] ?? '';
  } else if (type.body.mode === 'split') {
    const parts = content.split(/\n+---\n+/);
    type.body.parts.forEach((p, i) => (secs[p] = (parts[i] ?? '').trim()));
  }

  return { values, body, sections: secs };
}
