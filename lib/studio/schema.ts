/*
 * Studio content schema — the declarative field registry the create/edit
 * forms render from and the API validates against. It mirrors the frontmatter
 * that lib/vault/parse.ts expects (required fields, enum options), so a file
 * produced from a schema passes the parser by construction.
 *
 * This is the single place "every surface" is described. Adding a surface is
 * a data entry here, not new form/route code. Kept plain-data (no functions)
 * so a ContentType can cross the server -> client boundary into the form.
 *
 * Dynamic defaults use sentinels ('@today', '@year') resolved server-side in
 * the new-entry page, so the schema itself stays static/serializable.
 */

export type FieldType = 'text' | 'textarea' | 'select' | 'date' | 'number' | 'tags' | 'boolean';

export interface Field {
  name: string;            // frontmatter key, verbatim (e.g. 'progress-pct')
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];      // for select
  placeholder?: string;
  help?: string;
  default?: string | boolean;   // literal, or '@today' / '@year'
}

export type BodyConfig =
  | { mode: 'freeform'; label: string; placeholder?: string }
  | { mode: 'sections'; sections: string[] }
  | { mode: 'none' };

export interface ContentType {
  key: string;             // 'notebook-note'
  label: string;           // 'Note'
  folder: string;          // vault folder, no trailing slash
  route: string;           // public URL prefix, e.g. '/notebook'
  titleField: string;      // field whose value becomes the slug + filename
  fixed?: Record<string, string | boolean>;  // constant frontmatter (e.g. type: note)
  fields: Field[];
  body: BodyConfig;
}

const STATUS_LIBRARY = ['planned', 'reading', 'finished', 'abandoned', 're-reading', 'wishlist'];

export const CONTENT_TYPES: ContentType[] = [
  {
    key: 'notebook-note',
    label: 'Note',
    folder: 'notebook',
    route: '/notebook',
    titleField: 'title',
    fixed: { type: 'note', draft: false },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'date', label: 'Date', type: 'date', default: '@today' },
      { name: 'thread', label: 'Thread', type: 'text', placeholder: 'e.g. working', help: 'Slug of a notebook thread, optional.' },
      { name: 'tags', label: 'Tags', type: 'tags' },
      { name: 'epistemic-status', label: 'Epistemic status', type: 'text' },
    ],
    body: { mode: 'freeform', label: 'Note', placeholder: 'Write the note. Markdown and [[wikilinks]] supported.' },
  },
  {
    key: 'notebook-essay',
    label: 'Essay',
    folder: 'notebook',
    route: '/notebook',
    titleField: 'title',
    fixed: { type: 'essay', draft: true },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'dek', label: 'Dek', type: 'text', help: 'One-line summary under the title.' },
      { name: 'date', label: 'Date', type: 'date', default: '@today' },
      { name: 'thread', label: 'Thread', type: 'text', placeholder: 'e.g. working' },
      { name: 'tags', label: 'Tags', type: 'tags' },
      { name: 'epistemic-status', label: 'Epistemic status', type: 'text' },
    ],
    body: { mode: 'freeform', label: 'Essay', placeholder: 'Write the essay. Starts as a draft.' },
  },
  {
    key: 'library-book',
    label: 'Book',
    folder: 'library',
    route: '/library',
    titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'author', label: 'Author', type: 'text', required: true },
      { name: 'status', label: 'Status', type: 'select', required: true, options: STATUS_LIBRARY, default: 'reading' },
      { name: 'year', label: 'Year', type: 'number', default: '@year' },
      { name: 'rating', label: 'Rating (1-5)', type: 'number' },
      { name: 'isbn', label: 'ISBN', type: 'text' },
      { name: 'genre', label: 'Genre', type: 'tags' },
      { name: 'source', label: 'Source', type: 'text', placeholder: 'e.g. reMarkable (PDF)' },
      { name: 'progress-pct', label: 'Progress %', type: 'number' },
      { name: 'started', label: 'Started', type: 'date' },
      { name: 'finished', label: 'Finished', type: 'date' },
    ],
    body: { mode: 'sections', sections: ['Notes', 'Review'] },
  },
];

export function getContentType(key: string): ContentType | undefined {
  return CONTENT_TYPES.find((t) => t.key === key);
}
