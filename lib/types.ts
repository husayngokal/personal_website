/*
 * Typed content models matching BRIEF.md Appendix D (YAML frontmatter
 * schemas). When the Obsidian → Postgres pipeline lands (Part XII/XIII),
 * the markdown frontmatter parses into these same shapes, so consumer
 * code (pages, components, search) stays unchanged.
 */

export type SurfaceKey =
  | 'notebook'
  | 'library'
  | 'projects'
  | 'mental-models'
  | 'study'
  | 'life';

/* -- Notebook ------------------------------------------------------ */
export type NotebookKind = 'essay' | 'note';
export interface NotebookPost {
  slug: string;
  kind: NotebookKind;
  title: string;
  dek?: string;
  date: string;            // ISO yyyy-mm-dd
  updated?: string;
  thread?: string;         // thread slug (filename in /notebook/threads/)
  tags?: string[];
  epistemicStatus?: string;
  draft?: boolean;
  wordCount?: number;
  body: string;            // markdown
}
export interface NotebookThread {
  slug: string;
  name: string;            // display name
  summary: string;
  state: 'active' | 'dormant' | 'concluded';
}

/* -- Library ------------------------------------------------------- */
export type BookStatus =
  | 'planned' | 'reading' | 'finished' | 'abandoned' | 're-reading' | 'wishlist';
export interface Book {
  slug: string;
  title: string;
  author: string;
  isbn?: string;
  status: BookStatus;
  year: number;
  started?: string;
  finished?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  genre?: string[];
  language?: string;
  source?: string;
  progressPct?: number;    // 0-100
  notes?: string;
  review?: string;
  passages?: { text: string; page?: string }[];
  /** Manual override via vault frontmatter, OR auto-discovered URL
   *  from Open Library populated by the sync pipeline. */
  coverUrl?: string;
}

/* -- Projects ------------------------------------------------------ */
export type ProjectStatus =
  | 'active' | 'paused' | 'dormant' | 'concluded' | 'shipped' | 'dead';
export interface ProjectPage {
  slug: string;
  title: string;
  tagline: string;
  status: ProjectStatus;
  started?: string;
  ended?: string;
  tags?: string[];
  repo?: string;
  repoPrivate?: boolean;
  externalUrl?: string;
  lastActive: string;
  currentState?: string;
  stuckOn?: string[];
  tasks?: { backlog?: string[]; inProgress?: string[]; done?: string[] };
  activity?: { date: string; line: string; branch?: string }[];
  decisions?: { date: string; title: string; body: string }[];
}

/* -- Mental Models ------------------------------------------------- */
export type ModelType = 'curated' | 'original' | 'hybrid';
export type DepthIndicator =
  | 'dabbled' | 'learning' | 'working-in' | 'teaching-from' | 'decayed';
export interface MentalModel {
  slug: string;
  title: string;
  origin?: string;
  type: ModelType;
  related?: string[];
  tags?: string[];
  lastReviewed?: string;
  depth?: DepthIndicator;
  oneLine: string;          // shown on index card
  body?: string;            // "the model" prose
  framing?: string;         // Husayn's framing — manifesto callout body
  whenToReach?: string[];
  whenNotTo?: string[];
  inTheWild?: { href: string; label: string; sub?: string }[];
  sources?: { href?: string; label: string }[];
  changedMyMind?: { date: string; body: string }[];
}

/* -- Study Log ----------------------------------------------------- */
export interface StudyCredential {
  slug: string;
  title: string;
  fullTitle?: string;
  institution: string;
  earned?: string;
  pending?: boolean;
  expires?: string;
  examDate?: string;
  depth: DepthIndicator;
  lastAssessed: string;
  tags?: string[];
  whatStuck: string;
  whatDidnt: string;
  sources?: { href?: string; label: string }[];
}
export interface StudyDomain {
  slug: string;
  title: string;
  depth: DepthIndicator;
  body: string;            // 300-800 word narrative
}
export interface Publication {
  slug: string;
  title: string;
  venue: string;
  year: number;
  authors: string;
  href?: string;
}
export interface Conference {
  slug: string;
  name: string;
  year: number;
  role: string;
  talk?: string;
}

/* -- Life Plan ----------------------------------------------------- */
/* Ideas — public ideation log for the website itself (and projects
   spun out of it). Each entry is a proposal with a status: open,
   exploring, building, shipped, dropped. Lives at /ideas; entries
   in the vault at /ideas/<slug>.md. */
export type IdeaStatus = 'open' | 'exploring' | 'building' | 'shipped' | 'dropped';
export interface Idea {
  slug: string;
  title: string;
  summary: string;            // one-sentence pitch shown on the index
  status: IdeaStatus;
  proposed: string;           // ISO date when the idea landed
  tags?: string[];
  body: string;               // full markdown writeup
  shippedAs?: string;         // optional URL if it shipped (link to the page/feature)
}

/* The Master Plan — the operating document for the entire life. 18
   Parts, each a long structured markdown document. Imported from the
   author's working PDF; lives in the vault as one .md per Part. */
export interface MasterPlanPart {
  slug: string;
  partNumber: number;
  title: string;
  body: string;
  summary?: string;
}

/* Public tasks — what the author is actively working on, published
   for accountability. Vault path: /tasks/*.md. Edits go through the
   standard webhook; the public can read but not write (no auth UI).
   Tasks complement the multi-scale Goals on the Life Plan with
   finer-grained, time-bounded items. */
export type TaskStatus =
  | 'open' | 'in-progress' | 'done' | 'dropped' | 'blocked';
export type TaskScope =
  | 'today' | 'this-week' | 'this-month' | 'this-quarter' | 'this-year' | 'lifetime';
/* Recurrence — for cron-style routines that should re-appear on a
   schedule (daily shutdown, weekly review, monthly review, etc.).
   `null` means the task is one-shot. The UI shows a small badge
   when this is set; status is allowed to be re-opened automatically
   on the next tick (handled application-side, not in the table). */
export type TaskRecurrence =
  | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
/* Optional category to group tasks beyond scope — e.g. the 9 artifact
   categories from Part 15 (software, ai, math, …) so the reader can
   navigate the artifact backlog by domain. */
export interface Task {
  slug: string;
  title: string;
  status: TaskStatus;
  scope: TaskScope;
  priority?: number;          // 1 = high, 2 = mid (default), 3 = low
  project?: string;           // optional project slug to link to
  due?: string;               // ISO date when due
  completed?: string;         // ISO date when status flipped to 'done'
  notes?: string;             // markdown body, rendered inline
  ordinal?: number;           // sort order within scope (lower = first)
  recurrence?: TaskRecurrence; // cron-style routines
  category?: string;          // optional grouping (e.g. 'software', 'ai')
}

export interface LifePrinciple {
  slug: string;
  title: string;
  order: number;
  manifesto: string;       // italic serif body in callout
  body?: string;           // explanation below callout
  established?: string;
  revised?: string;
  tags?: string[];
}
export interface JourneyEntry {
  date: string;
  title: string;
  reflection?: string;
}
export type GoalStatus =
  | 'completed' | 'partially-completed' | 'dropped' | 'rolled-over' | 'in-progress' | 'planned';
export interface LifeGoal {
  slug: string;
  scale: 'lifetime' | 'five-year' | 'this-year' | 'this-quarter' | 'this-month';
  year?: number;
  title: string;
  status: GoalStatus;
  note?: string;
}
/* -- Courses (Curriculum surface) --------------------------------- */
export type CredentialType =
  | 'transcript' | 'diploma' | 'certificate' | 'letter' | 'other';
export interface Credential {
  slug: string;
  title: string;
  institution?: string;
  year?: number;
  type: CredentialType;
  /** Path UNDER the media bucket, e.g. "credentials/hid-transcript.pdf".
   *  Combined with NEXT_PUBLIC_VAULT_MEDIA_URL by the page to produce
   *  the public download URL. Optional — LinkedIn-imported certifications
   *  have only a verification URL and no downloadable file. */
  filePath?: string;
  dateIssued?: string;       // "2020-06" or "2020-06-15"
  description?: string;
  verificationUrl?: string;
  isPublic: boolean;
  body?: string;
}

export type WriteupKind       = 'machine' | 'technique';
export type WriteupPlatform   = 'htb' | 'thm' | 'vulnhub' | 'portswigger' | 'ctf' | 'other';
export type WriteupDifficulty = 'easy' | 'medium' | 'hard' | 'insane';
export type WriteupOS         = 'linux' | 'windows' | 'other';
export type WriteupStatus     = 'rooted' | 'foothold' | 'attempted' | 'abandoned';
export interface Writeup {
  slug: string;
  title: string;
  kind: WriteupKind;
  /** Free-text taxonomy for technique entries: tool, methodology,
   *  concept, reconnaissance, exploitation, post-exploitation, reference. */
  category?: string;
  /** Box-specific fields below — populated when kind=machine, omitted otherwise. */
  platform?: WriteupPlatform;
  difficulty?: WriteupDifficulty;
  os?: WriteupOS;
  points?: number;
  status?: WriteupStatus;
  ip?: string;
  /** Universal fields */
  date?: string;
  tags?: string[];
  techniques?: string[];
  body?: string;
}

export type CourseStatus = 'planned' | 'studying' | 'completed' | 'abandoned';
export interface CourseTextbook {
  title: string;
  authors?: string;
  edition?: string;
  isbn?: string;
  freeLink?: string;
}
export interface CourseSyllabusEntry {
  week?: number;
  topic: string;
  reading?: string;
  deliverables?: string;
}
export interface Course {
  slug: string;
  code: string | null;
  title: string;
  university: string;
  department?: string;
  bannerImage?: string;
  sourceUrl?: string;
  videoUrl?: string;
  professors?: string[];
  textbooks?: CourseTextbook[];
  prerequisites?: string[];      // slugs of other courses
  estTotalHours?: number;
  weeklyHours?: number;
  syllabus?: CourseSyllabusEntry[];
  status: CourseStatus;
  started?: string;
  finished?: string;
  order: number;
  tags?: string[];
  body?: string;
}

/* -- Living (group surfaces: bucket list, field atlas, etc.) ------ */
export interface LivingEntry {
  slug: string;
  title: string;
  summary?: string;
  body: string;
  orderIdx: number;
  lastEditedAt?: string;
}

export interface ChangedMyMindEntry {
  slug: string;
  title: string;
  dateChanged: string;
  previous: string;
  next: string;
  tags?: string[];
}
export interface StoryVignette {
  slug: string;
  title: string;
  body: string;
}
