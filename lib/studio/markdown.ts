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
  }

  /* gray-matter stringify -> ---\n<yaml>---\n<body>. Trailing newline for
     a tidy diff. */
  const content = matter.stringify(body ? `\n${body}\n` : '\n', fm);
  const path = `${type.folder}/${slug}.md`;
  const url = `${type.route}/${slug}`;
  return { slug, path, content, url };
}
