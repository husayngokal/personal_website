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
 *
 * Excluded on purpose: life/motto.md (a single evergreen file, edit-only) and
 * the comment-moderation queue (not authoring).
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
  | { mode: 'none' }
  | { mode: 'freeform'; label: string; placeholder?: string }
  | { mode: 'sections'; sections: string[] }   // '## Heading' blocks
  | { mode: 'split'; parts: string[] };        // parts joined by \n\n---\n\n

export interface ContentType {
  key: string;             // 'notebook-note'
  label: string;           // 'Note'
  group: string;           // UI grouping on the landing page
  folder: string;          // vault folder, no trailing slash
  route: string;           // public URL prefix for the "view" link
  titleField: string;      // field whose value becomes the slug
  numberPrefix?: { field: string; pad: number };  // filename like 01-slug.md
  fixed?: Record<string, string | boolean>;       // constant frontmatter
  fields: Field[];
  body: BodyConfig;
}

/* -- enum option sets, mirrored from parse.ts pick() calls -- */
const LIBRARY_STATUS = ['planned', 'reading', 'finished', 'abandoned', 're-reading', 'wishlist'];
const THREAD_STATE = ['active', 'dormant', 'concluded'];
const MM_TYPE = ['curated', 'original', 'hybrid'];
const DEPTH = ['dabbled', 'learning', 'working-in', 'teaching-from', 'decayed'];
const COURSE_STATUS = ['planned', 'studying', 'completed', 'abandoned'];
const WU_PLATFORM = ['htb', 'thm', 'vulnhub', 'portswigger', 'ctf', 'other'];
const WU_MSTATUS = ['rooted', 'foothold', 'attempted', 'abandoned'];
const WU_CATEGORY = ['tool', 'methodology', 'concept', 'reconnaissance', 'exploitation', 'post-exploitation', 'reference'];
const CRED_TYPE = ['transcript', 'diploma', 'certificate', 'letter', 'other'];
const IDEA_STATUS = ['open', 'exploring', 'building', 'shipped', 'dropped'];
const PROJECT_STATUS = ['active', 'paused', 'dormant', 'concluded', 'shipped', 'dead'];
const TASK_STATUS = ['open', 'in-progress', 'done', 'dropped', 'blocked'];
const TASK_SCOPE = ['today', 'this-week', 'this-month', 'this-quarter', 'this-year', 'lifetime'];
const TASK_RECUR = ['', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
const RESEARCH_STATUS = ['gathering', 'exploring', 'writing', 'shipped', 'dormant'];
const GOAL_SCALE = ['lifetime', 'five-year', 'this-year', 'this-quarter', 'this-month'];
const GOAL_STATUS = ['completed', 'partially-completed', 'dropped', 'rolled-over', 'in-progress', 'planned'];

export const CONTENT_TYPES: ContentType[] = [
  /* ---- Notebook ---- */
  {
    key: 'notebook-note', label: 'Note', group: 'Notebook',
    folder: 'notebook', route: '/notebook', titleField: 'title',
    fixed: { type: 'note', draft: false },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'date', label: 'Date', type: 'date', default: '@today' },
      { name: 'thread', label: 'Thread', type: 'text', placeholder: 'e.g. working', help: 'Slug of a notebook thread, optional.' },
      { name: 'tags', label: 'Tags', type: 'tags' },
      { name: 'epistemic-status', label: 'Epistemic status', type: 'text' },
    ],
    body: { mode: 'freeform', label: 'Note', placeholder: 'Markdown and [[wikilinks]] supported.' },
  },
  {
    key: 'notebook-essay', label: 'Essay', group: 'Notebook',
    folder: 'notebook', route: '/notebook', titleField: 'title',
    fixed: { type: 'essay', draft: true },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'dek', label: 'Dek', type: 'text', help: 'One-line summary under the title.' },
      { name: 'date', label: 'Date', type: 'date', default: '@today' },
      { name: 'thread', label: 'Thread', type: 'text', placeholder: 'e.g. working' },
      { name: 'tags', label: 'Tags', type: 'tags' },
      { name: 'epistemic-status', label: 'Epistemic status', type: 'text' },
    ],
    body: { mode: 'freeform', label: 'Essay', placeholder: 'Starts as a draft.' },
  },
  {
    key: 'notebook-thread', label: 'Thread', group: 'Notebook',
    folder: 'notebook/threads', route: '/notebook/threads', titleField: 'name',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'state', label: 'State', type: 'select', required: true, options: THREAD_STATE, default: 'active' },
    ],
    body: { mode: 'freeform', label: 'Summary', placeholder: 'What this thread is about.' },
  },

  /* ---- Library ---- */
  {
    key: 'library-book', label: 'Book', group: 'Library',
    folder: 'library', route: '/library', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'author', label: 'Author', type: 'text', required: true },
      { name: 'status', label: 'Status', type: 'select', required: true, options: LIBRARY_STATUS, default: 'reading' },
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

  /* ---- Projects ---- */
  {
    key: 'project', label: 'Project', group: 'Work',
    folder: 'projects', route: '/projects', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'tagline', label: 'Tagline', type: 'text', required: true },
      { name: 'status', label: 'Status', type: 'select', required: true, options: PROJECT_STATUS, default: 'active' },
      { name: 'started', label: 'Started', type: 'date', default: '@today' },
      { name: 'last-active', label: 'Last active', type: 'date', help: 'Leave blank for "active today".' },
      { name: 'tags', label: 'Tags', type: 'tags' },
      { name: 'repo', label: 'Repo URL', type: 'text' },
      { name: 'external-url', label: 'External URL', type: 'text' },
    ],
    body: { mode: 'sections', sections: ['Current state', 'Currently stuck on', 'Decisions'] },
  },

  /* ---- Courses ---- */
  {
    key: 'course', label: 'Course', group: 'Study',
    folder: 'courses', route: '/courses', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'university', label: 'University', type: 'text', required: true, placeholder: 'mit, stanford, coursera, ens paris...' },
      { name: 'code', label: 'Course code', type: 'text' },
      { name: 'department', label: 'Department', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', required: true, options: COURSE_STATUS, default: 'planned' },
      { name: 'source-url', label: 'Source URL', type: 'text' },
      { name: 'video-url', label: 'Video URL', type: 'text' },
      { name: 'est-total-hours', label: 'Est. total hours', type: 'number' },
      { name: 'started', label: 'Started', type: 'date' },
      { name: 'tags', label: 'Tags', type: 'tags' },
    ],
    body: { mode: 'freeform', label: 'Framing', placeholder: 'Why this course, what you want from it.' },
  },

  /* ---- Writeups ---- */
  {
    key: 'writeup-machine', label: 'Writeup (machine)', group: 'Writeups',
    folder: 'writeups', route: '/writeups', titleField: 'title',
    fixed: { kind: 'machine' },
    fields: [
      { name: 'title', label: 'Machine name', type: 'text', required: true },
      { name: 'platform', label: 'Platform', type: 'select', required: true, options: WU_PLATFORM, default: 'htb' },
      { name: 'status', label: 'Status', type: 'select', required: true, options: WU_MSTATUS, default: 'rooted' },
      { name: 'difficulty', label: 'Difficulty', type: 'text', placeholder: 'easy | medium | hard | insane' },
      { name: 'os', label: 'OS', type: 'text', placeholder: 'linux | windows | other' },
      { name: 'points', label: 'Points', type: 'number' },
      { name: 'date', label: 'Date', type: 'date', default: '@today' },
      { name: 'tags', label: 'Tags', type: 'tags' },
      { name: 'techniques', label: 'Techniques', type: 'tags' },
    ],
    body: { mode: 'sections', sections: ['Recon', 'Foothold', 'Privilege Escalation', 'Root', 'Lessons'] },
  },
  {
    key: 'writeup-technique', label: 'Writeup (technique)', group: 'Writeups',
    folder: 'writeups', route: '/writeups', titleField: 'title',
    fixed: { kind: 'technique' },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'category', label: 'Category', type: 'select', options: WU_CATEGORY, default: 'tool' },
      { name: 'date', label: 'Date', type: 'date', default: '@today' },
      { name: 'tags', label: 'Tags', type: 'tags' },
      { name: 'techniques', label: 'Techniques', type: 'tags' },
    ],
    body: { mode: 'freeform', label: 'Body' },
  },

  /* ---- Credentials (downloadable docs) ---- */
  {
    key: 'credential', label: 'Credential', group: 'Study',
    folder: 'credentials', route: '/credentials', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'institution', label: 'Institution', type: 'text' },
      { name: 'type', label: 'Type', type: 'select', required: true, options: CRED_TYPE, default: 'certificate' },
      { name: 'year', label: 'Year', type: 'number' },
      { name: 'file', label: 'File path', type: 'text', placeholder: 'credentials/... (under media CDN)' },
      { name: 'date-issued', label: 'Date issued', type: 'text', placeholder: '2020-06 or 2020-06-15' },
      { name: 'verification-url', label: 'Verification URL', type: 'text' },
      { name: 'description', label: 'Description', type: 'text' },
      { name: 'public', label: 'Public', type: 'boolean', default: true },
    ],
    body: { mode: 'freeform', label: 'Context', placeholder: 'Optional.' },
  },

  /* ---- Study credentials (skills ledger) ---- */
  {
    key: 'study-credential', label: 'Study credential', group: 'Study',
    folder: 'study/credentials', route: '/study/credentials', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'full-title', label: 'Full title', type: 'text' },
      { name: 'institution', label: 'Institution', type: 'text', required: true },
      { name: 'depth', label: 'Depth', type: 'select', required: true, options: DEPTH, default: 'learning' },
      { name: 'last-assessed', label: 'Last assessed', type: 'date', required: true, default: '@today' },
      { name: 'earned', label: 'Earned', type: 'date' },
      { name: 'pending', label: 'Pending', type: 'boolean' },
      { name: 'exam-date', label: 'Exam date', type: 'date' },
      { name: 'expires', label: 'Expires', type: 'date' },
      { name: 'tags', label: 'Tags', type: 'tags' },
    ],
    body: { mode: 'sections', sections: ['What stuck', "What didn't"] },
  },

  /* ---- Study domains ---- */
  {
    key: 'study-domain', label: 'Study domain', group: 'Study',
    folder: 'study/domains', route: '/study/domains', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'depth', label: 'Depth', type: 'select', required: true, options: DEPTH, default: 'learning' },
    ],
    body: { mode: 'freeform', label: 'Narrative' },
  },

  /* ---- Mental models ---- */
  {
    key: 'mental-model', label: 'Mental model', group: 'Study',
    folder: 'mental-models', route: '/mental-models', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'one-line', label: 'One-line', type: 'text', required: true },
      { name: 'type', label: 'Type', type: 'select', required: true, options: MM_TYPE, default: 'curated' },
      { name: 'depth', label: 'Depth', type: 'select', required: true, options: DEPTH, default: 'learning' },
      { name: 'origin', label: 'Origin', type: 'text' },
      { name: 'related', label: 'Related', type: 'tags' },
      { name: 'tags', label: 'Tags', type: 'tags' },
      { name: 'last-reviewed', label: 'Last reviewed', type: 'date', default: '@today' },
    ],
    body: { mode: 'sections', sections: ['The model', "Husayn's framing", 'When to reach for it', 'When not to', 'Sources'] },
  },

  /* ---- Ideas ---- */
  {
    key: 'idea', label: 'Idea', group: 'Work',
    folder: 'ideas', route: '/ideas', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'summary', label: 'Summary', type: 'text', required: true },
      { name: 'status', label: 'Status', type: 'select', required: true, options: IDEA_STATUS, default: 'open' },
      { name: 'proposed', label: 'Proposed', type: 'date', required: true, default: '@today' },
      { name: 'tags', label: 'Tags', type: 'tags' },
      { name: 'shipped-as', label: 'Shipped as', type: 'text' },
    ],
    body: { mode: 'freeform', label: 'Body' },
  },

  /* ---- Tasks ---- */
  {
    key: 'task', label: 'Task', group: 'Work',
    folder: 'tasks', route: '/life/tasks', titleField: 'title',
    fields: [
      { name: 'title', label: 'Task', type: 'text', required: true },
      { name: 'status', label: 'Status', type: 'select', required: true, options: TASK_STATUS, default: 'open' },
      { name: 'scope', label: 'Scope', type: 'select', required: true, options: TASK_SCOPE, default: 'this-week' },
      { name: 'priority', label: 'Priority', type: 'number' },
      { name: 'project', label: 'Project', type: 'text' },
      { name: 'due', label: 'Due', type: 'date' },
      { name: 'recurrence', label: 'Recurrence', type: 'select', options: TASK_RECUR },
      { name: 'category', label: 'Category', type: 'text' },
    ],
    body: { mode: 'freeform', label: 'Notes' },
  },

  /* ---- Research topics ---- */
  {
    key: 'research-topic', label: 'Research topic', group: 'Work',
    folder: 'research', route: '/research', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'summary', label: 'Summary', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', required: true, options: RESEARCH_STATUS, default: 'gathering' },
      { name: 'started', label: 'Started', type: 'date', default: '@today' },
      { name: 'tags', label: 'Tags', type: 'tags' },
    ],
    body: { mode: 'freeform', label: 'Body' },
  },

  /* ---- Living entries ---- */
  {
    key: 'living-entry', label: 'Living entry', group: 'Work',
    folder: 'living', route: '/living', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'summary', label: 'Summary', type: 'text' },
      { name: 'order', label: 'Order', type: 'number' },
    ],
    body: { mode: 'freeform', label: 'Body' },
  },

  /* ---- Life: principles ---- */
  {
    key: 'life-principle', label: 'Principle', group: 'Life',
    folder: 'life/principles', route: '/life', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'order', label: 'Order', type: 'number' },
      { name: 'established', label: 'Established', type: 'date' },
      { name: 'revised', label: 'Revised', type: 'date' },
      { name: 'tags', label: 'Tags', type: 'tags' },
    ],
    body: { mode: 'split', parts: ['Manifesto', 'Explanation'] },
  },

  /* ---- Life: goals ---- */
  {
    key: 'life-goal', label: 'Goal', group: 'Life',
    folder: 'life/goals', route: '/life', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'scale', label: 'Scale', type: 'select', required: true, options: GOAL_SCALE, default: 'this-year' },
      { name: 'status', label: 'Status', type: 'select', required: true, options: GOAL_STATUS, default: 'planned' },
      { name: 'year', label: 'Year', type: 'number', default: '@year' },
    ],
    body: { mode: 'freeform', label: 'Note' },
  },

  /* ---- Life: changed my mind ---- */
  {
    key: 'life-changed-my-mind', label: 'Changed my mind', group: 'Life',
    folder: 'life/changed-my-mind', route: '/life/changed-my-mind', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'date-changed', label: 'Date changed', type: 'date', required: true, default: '@today' },
      { name: 'tags', label: 'Tags', type: 'tags' },
    ],
    body: { mode: 'sections', sections: ['Previously', 'Now'] },
  },

  /* ---- Life: journey entries ---- */
  {
    key: 'life-journey-entry', label: 'Journey entry', group: 'Life',
    folder: 'life/journey', route: '/life', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true, default: '@today' },
      { name: 'ordinal', label: 'Ordinal', type: 'number' },
    ],
    body: { mode: 'freeform', label: 'Reflection' },
  },

  /* ---- Life: master plan parts (filename NN-slug) ---- */
  {
    key: 'life-master-plan', label: 'Master plan part', group: 'Life',
    folder: 'life/master-plan', route: '/life/plan', titleField: 'title',
    numberPrefix: { field: 'part', pad: 2 },
    fields: [
      { name: 'part', label: 'Part number', type: 'number', required: true },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'summary', label: 'Summary', type: 'text' },
    ],
    body: { mode: 'freeform', label: 'Body' },
  },

  /* ---- Life: story vignettes (filename NN-slug) ---- */
  {
    key: 'life-story-vignette', label: 'Story vignette', group: 'Life',
    folder: 'life/story', route: '/life', titleField: 'title',
    numberPrefix: { field: 'ordinal', pad: 2 },
    fields: [
      { name: 'ordinal', label: 'Ordinal', type: 'number', required: true },
      { name: 'title', label: 'Title', type: 'text', required: true },
    ],
    body: { mode: 'freeform', label: 'Body' },
  },
];

export function getContentType(key: string): ContentType | undefined {
  return CONTENT_TYPES.find((t) => t.key === key);
}
