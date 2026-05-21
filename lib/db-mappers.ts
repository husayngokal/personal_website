/*
 * Bidirectional mappers between TypeScript camelCase (the in-app shape)
 * and Postgres snake_case (the table columns).
 *
 * The mapping is explicit per-field rather than auto-generated because:
 *   - some columns reserve SQL keywords (e.g. `order_`, `next_`) so we
 *     can't rely on a blanket camelCase→snake_case rule
 *   - the JSONB columns store sub-objects whose internal field names
 *     stay camelCase (consumed only by JS, never queried as columns)
 *
 * Used by:
 *   - scripts/seed.ts (to push lib/data/* into Postgres)
 *   - lib/content/* (to read DB rows back into the typed shapes)
 */

import type {
  NotebookPost, NotebookThread,
  Book,
  ProjectPage,
  MentalModel,
  StudyCredential, StudyDomain, Publication, Conference,
  LifePrinciple, JourneyEntry, LifeGoal, ChangedMyMindEntry, StoryVignette,
  MasterPlanPart, Task, TaskStatus, TaskScope, TaskRecurrence,
  Idea, IdeaStatus,
  Course, CourseStatus,
  Writeup, WriteupKind, WriteupPlatform, WriteupDifficulty, WriteupOS, WriteupStatus,
  Credential, CredentialType,
} from './types';

/* ============================================================
 * NOTEBOOK
 * ============================================================ */
export const toRow = {
  notebookThread: (t: NotebookThread) => ({
    slug: t.slug, name: t.name, summary: t.summary, state: t.state,
  }),
  notebookPost: (p: NotebookPost) => ({
    slug: p.slug, kind: p.kind, title: p.title, dek: p.dek ?? null,
    date: p.date, updated: p.updated ?? null,
    thread: p.thread ?? null, tags: p.tags ?? null,
    epistemic_status: p.epistemicStatus ?? null,
    draft: p.draft ?? false, word_count: p.wordCount ?? null,
    body: p.body,
  }),

  book: (b: Book) => ({
    slug: b.slug, title: b.title, author: b.author, isbn: b.isbn ?? null,
    status: b.status, year: b.year,
    started: b.started ?? null, finished: b.finished ?? null,
    rating: b.rating ?? null, genre: b.genre ?? null,
    language: b.language ?? null, source: b.source ?? null,
    progress_pct: b.progressPct ?? null,
    notes: b.notes ?? null, review: b.review ?? null,
    passages: b.passages ?? null,
    cover_url: b.coverUrl ?? null,
  }),

  project: (p: ProjectPage) => ({
    slug: p.slug, title: p.title, tagline: p.tagline, status: p.status,
    started: p.started ?? null, ended: p.ended ?? null,
    tags: p.tags ?? null, repo: p.repo ?? null,
    repo_private: p.repoPrivate ?? false,
    external_url: p.externalUrl ?? null,
    last_active: p.lastActive,
    current_state: p.currentState ?? null,
    stuck_on: p.stuckOn ?? null,
    tasks: p.tasks ?? null, activity: p.activity ?? null, decisions: p.decisions ?? null,
  }),

  mentalModel: (m: MentalModel) => ({
    slug: m.slug, title: m.title, origin: m.origin ?? null,
    type: m.type, related: m.related ?? null, tags: m.tags ?? null,
    last_reviewed: m.lastReviewed ?? null, depth: m.depth ?? null,
    one_line: m.oneLine, body: m.body ?? null, framing: m.framing ?? null,
    when_to_reach: m.whenToReach ?? null, when_not_to: m.whenNotTo ?? null,
    in_the_wild: m.inTheWild ?? null,
    sources: m.sources ?? null,
    changed_my_mind: m.changedMyMind ?? null,
  }),

  studyCredential: (c: StudyCredential) => ({
    slug: c.slug, title: c.title, full_title: c.fullTitle ?? null,
    institution: c.institution,
    earned: c.earned ?? null, pending: c.pending ?? false,
    expires: c.expires ?? null,
    depth: c.depth, last_assessed: c.lastAssessed,
    tags: c.tags ?? null,
    what_stuck: c.whatStuck, what_didnt: c.whatDidnt,
    sources: c.sources ?? null,
  }),
  studyDomain: (d: StudyDomain) => ({
    slug: d.slug, title: d.title, depth: d.depth, body: d.body,
  }),
  publication: (p: Publication) => ({
    slug: p.slug, title: p.title, venue: p.venue, year: p.year,
    authors: p.authors, href: p.href ?? null,
  }),
  conference: (c: Conference) => ({
    slug: c.slug, name: c.name, year: c.year, role: c.role, talk: c.talk ?? null,
  }),

  lifePrinciple: (p: LifePrinciple) => ({
    slug: p.slug, title: p.title, order_: p.order,
    manifesto: p.manifesto, body: p.body ?? null,
    established: p.established ?? null, revised: p.revised ?? null,
    tags: p.tags ?? null,
  }),
  storyVignette: (v: StoryVignette, ordinal: number) => ({
    slug: v.slug, title: v.title, body: v.body, ordinal,
  }),
  journeyEntry: (j: JourneyEntry, ordinal: number) => ({
    date: j.date, title: j.title, reflection: j.reflection ?? null, ordinal,
  }),
  lifeGoal: (g: LifeGoal) => ({
    slug: g.slug, scale: g.scale, year: g.year ?? null,
    title: g.title, status: g.status, note: g.note ?? null,
  }),
  changedMyMind: (c: ChangedMyMindEntry) => ({
    slug: c.slug, title: c.title, date_changed: c.dateChanged,
    previous: c.previous, next_: c.next, tags: c.tags ?? null,
  }),

  course: (c: Course) => ({
    slug: c.slug, code: c.code, title: c.title,
    university: c.university, department: c.department ?? null,
    banner_image: c.bannerImage ?? null,
    source_url: c.sourceUrl ?? null,
    video_url: c.videoUrl ?? null,
    professors: c.professors ?? null,
    textbooks: c.textbooks ?? null,
    prerequisites: c.prerequisites ?? null,
    est_total_hours: c.estTotalHours ?? null,
    weekly_hours: c.weeklyHours ?? null,
    syllabus: c.syllabus ?? null,
    status: c.status,
    started: c.started ?? null,
    finished: c.finished ?? null,
    order_: c.order,
    tags: c.tags ?? null,
    body: c.body ?? null,
  }),

  credential: (c: Credential) => ({
    slug: c.slug, title: c.title,
    institution: c.institution ?? null,
    year: c.year ?? null,
    type: c.type,
    file_path: c.filePath,
    date_issued: c.dateIssued ?? null,
    description: c.description ?? null,
    verification_url: c.verificationUrl ?? null,
    is_public: c.isPublic,
    body: c.body ?? null,
  }),

  writeup: (w: Writeup) => ({
    slug: w.slug, title: w.title,
    kind: w.kind,
    category: w.category ?? null,
    platform: w.platform ?? null,
    difficulty: w.difficulty ?? null,
    os: w.os ?? null,
    points: w.points ?? null,
    status: w.status ?? null,
    date: w.date ?? null,
    ip: w.ip ?? null,
    tags: w.tags ?? null,
    techniques: w.techniques ?? null,
    body: w.body ?? null,
  }),
};

/* ============================================================
 * Row → typed shape (inverse mapping)
 * ============================================================ */
type Row = Record<string, unknown>;

export const fromRow = {
  notebookThread: (r: Row): NotebookThread => ({
    slug:    r.slug as string,
    name:    r.name as string,
    summary: r.summary as string,
    state:   r.state as NotebookThread['state'],
  }),
  notebookPost: (r: Row): NotebookPost => ({
    slug: r.slug as string,
    kind: r.kind as NotebookPost['kind'],
    title: r.title as string,
    dek: (r.dek as string) ?? undefined,
    date: r.date as string,
    updated: (r.updated as string) ?? undefined,
    thread: (r.thread as string) ?? undefined,
    tags: (r.tags as string[]) ?? undefined,
    epistemicStatus: (r.epistemic_status as string) ?? undefined,
    draft: (r.draft as boolean) ?? false,
    wordCount: (r.word_count as number) ?? undefined,
    body: r.body as string,
  }),

  book: (r: Row): Book => ({
    slug: r.slug as string,
    title: r.title as string,
    author: r.author as string,
    isbn: (r.isbn as string) ?? undefined,
    status: r.status as Book['status'],
    year: r.year as number,
    started: (r.started as string) ?? undefined,
    finished: (r.finished as string) ?? undefined,
    rating: (r.rating as 1 | 2 | 3 | 4 | 5) ?? undefined,
    genre: (r.genre as string[]) ?? undefined,
    language: (r.language as string) ?? undefined,
    source: (r.source as string) ?? undefined,
    progressPct: (r.progress_pct as number) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    review: (r.review as string) ?? undefined,
    passages: (r.passages as Book['passages']) ?? undefined,
    coverUrl: (r.cover_url as string) ?? undefined,
  }),

  project: (r: Row): ProjectPage => ({
    slug: r.slug as string,
    title: r.title as string,
    tagline: r.tagline as string,
    status: r.status as ProjectPage['status'],
    started: (r.started as string) ?? undefined,
    ended: (r.ended as string) ?? undefined,
    tags: (r.tags as string[]) ?? undefined,
    repo: (r.repo as string) ?? undefined,
    repoPrivate: (r.repo_private as boolean) ?? false,
    externalUrl: (r.external_url as string) ?? undefined,
    lastActive: r.last_active as string,
    currentState: (r.current_state as string) ?? undefined,
    stuckOn: (r.stuck_on as string[]) ?? undefined,
    tasks: (r.tasks as ProjectPage['tasks']) ?? undefined,
    activity: (r.activity as ProjectPage['activity']) ?? undefined,
    decisions: (r.decisions as ProjectPage['decisions']) ?? undefined,
  }),

  mentalModel: (r: Row): MentalModel => ({
    slug: r.slug as string,
    title: r.title as string,
    origin: (r.origin as string) ?? undefined,
    type: r.type as MentalModel['type'],
    related: (r.related as string[]) ?? undefined,
    tags: (r.tags as string[]) ?? undefined,
    lastReviewed: (r.last_reviewed as string) ?? undefined,
    depth: (r.depth as MentalModel['depth']) ?? undefined,
    oneLine: r.one_line as string,
    body: (r.body as string) ?? undefined,
    framing: (r.framing as string) ?? undefined,
    whenToReach: (r.when_to_reach as string[]) ?? undefined,
    whenNotTo: (r.when_not_to as string[]) ?? undefined,
    inTheWild: (r.in_the_wild as MentalModel['inTheWild']) ?? undefined,
    sources: (r.sources as MentalModel['sources']) ?? undefined,
    changedMyMind: (r.changed_my_mind as MentalModel['changedMyMind']) ?? undefined,
  }),

  studyCredential: (r: Row): StudyCredential => ({
    slug: r.slug as string,
    title: r.title as string,
    fullTitle: (r.full_title as string) ?? undefined,
    institution: r.institution as string,
    earned: (r.earned as string) ?? undefined,
    pending: (r.pending as boolean) ?? false,
    expires: (r.expires as string) ?? undefined,
    depth: r.depth as StudyCredential['depth'],
    lastAssessed: r.last_assessed as string,
    tags: (r.tags as string[]) ?? undefined,
    whatStuck: r.what_stuck as string,
    whatDidnt: r.what_didnt as string,
    sources: (r.sources as StudyCredential['sources']) ?? undefined,
  }),
  studyDomain: (r: Row): StudyDomain => ({
    slug: r.slug as string,
    title: r.title as string,
    depth: r.depth as StudyDomain['depth'],
    body: r.body as string,
  }),
  publication: (r: Row): Publication => ({
    slug: r.slug as string,
    title: r.title as string,
    venue: r.venue as string,
    year: r.year as number,
    authors: r.authors as string,
    href: (r.href as string) ?? undefined,
  }),
  conference: (r: Row): Conference => ({
    slug: r.slug as string,
    name: r.name as string,
    year: r.year as number,
    role: r.role as string,
    talk: (r.talk as string) ?? undefined,
  }),

  lifePrinciple: (r: Row): LifePrinciple => ({
    slug: r.slug as string,
    title: r.title as string,
    order: r.order_ as number,
    manifesto: r.manifesto as string,
    body: (r.body as string) ?? undefined,
    established: (r.established as string) ?? undefined,
    revised: (r.revised as string) ?? undefined,
    tags: (r.tags as string[]) ?? undefined,
  }),
  masterPlanPart: (r: Row): MasterPlanPart => ({
    slug: r.slug as string,
    partNumber: r.part_number as number,
    title: r.title as string,
    body: r.body as string,
    summary: (r.summary as string) ?? undefined,
  }),
  idea: (r: Row): Idea => ({
    slug: r.slug as string,
    title: r.title as string,
    summary: r.summary as string,
    status: r.status as IdeaStatus,
    proposed: r.proposed as string,
    tags: (r.tags as string[]) ?? undefined,
    body: (r.body as string) ?? '',
    shippedAs: (r.shipped_as as string) ?? undefined,
  }),
  task: (r: Row): Task => ({
    slug: r.slug as string,
    title: r.title as string,
    status: r.status as TaskStatus,
    scope: r.scope as TaskScope,
    priority: (r.priority as number) ?? undefined,
    project: (r.project as string) ?? undefined,
    due: (r.due as string) ?? undefined,
    completed: (r.completed as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    ordinal: (r.ordinal as number) ?? undefined,
    recurrence: (r.recurrence as TaskRecurrence) ?? undefined,
    category: (r.category as string) ?? undefined,
  }),
  storyVignette: (r: Row): StoryVignette => ({
    slug: r.slug as string,
    title: r.title as string,
    body: r.body as string,
  }),
  journeyEntry: (r: Row): JourneyEntry => ({
    date: r.date as string,
    title: r.title as string,
    reflection: (r.reflection as string) ?? undefined,
  }),
  lifeGoal: (r: Row): LifeGoal => ({
    slug: r.slug as string,
    scale: r.scale as LifeGoal['scale'],
    year: (r.year as number) ?? undefined,
    title: r.title as string,
    status: r.status as LifeGoal['status'],
    note: (r.note as string) ?? undefined,
  }),
  changedMyMind: (r: Row): ChangedMyMindEntry => ({
    slug: r.slug as string,
    title: r.title as string,
    dateChanged: r.date_changed as string,
    previous: r.previous as string,
    next: r.next_ as string,
    tags: (r.tags as string[]) ?? undefined,
  }),

  course: (r: Row): Course => ({
    slug: r.slug as string,
    code: (r.code as string) ?? null,
    title: r.title as string,
    university: r.university as string,
    department: (r.department as string) ?? undefined,
    bannerImage: (r.banner_image as string) ?? undefined,
    sourceUrl: (r.source_url as string) ?? undefined,
    videoUrl: (r.video_url as string) ?? undefined,
    professors: (r.professors as string[]) ?? undefined,
    textbooks: (r.textbooks as Course['textbooks']) ?? undefined,
    prerequisites: (r.prerequisites as string[]) ?? undefined,
    estTotalHours: (r.est_total_hours as number) ?? undefined,
    weeklyHours: (r.weekly_hours as number) ?? undefined,
    syllabus: (r.syllabus as Course['syllabus']) ?? undefined,
    status: r.status as CourseStatus,
    started: (r.started as string) ?? undefined,
    finished: (r.finished as string) ?? undefined,
    order: (r.order_ as number) ?? 0,
    tags: (r.tags as string[]) ?? undefined,
    body: (r.body as string) ?? undefined,
  }),

  credential: (r: Row): Credential => ({
    slug: r.slug as string,
    title: r.title as string,
    institution: (r.institution as string) ?? undefined,
    year: (r.year as number) ?? undefined,
    type: (r.type as CredentialType) ?? 'certificate',
    filePath: (r.file_path as string) ?? undefined,
    dateIssued: (r.date_issued as string) ?? undefined,
    description: (r.description as string) ?? undefined,
    verificationUrl: (r.verification_url as string) ?? undefined,
    isPublic: (r.is_public as boolean) ?? true,
    body: (r.body as string) ?? undefined,
  }),

  writeup: (r: Row): Writeup => ({
    slug: r.slug as string,
    title: r.title as string,
    kind: ((r.kind as WriteupKind) ?? 'technique'),
    category: (r.category as string) ?? undefined,
    platform: (r.platform as WriteupPlatform) ?? undefined,
    difficulty: (r.difficulty as WriteupDifficulty) ?? undefined,
    os: (r.os as WriteupOS) ?? undefined,
    points: (r.points as number) ?? undefined,
    status: (r.status as WriteupStatus) ?? undefined,
    date: (r.date as string) ?? undefined,
    ip: (r.ip as string) ?? undefined,
    tags: (r.tags as string[]) ?? undefined,
    techniques: (r.techniques as string[]) ?? undefined,
    body: (r.body as string) ?? undefined,
  }),
};
