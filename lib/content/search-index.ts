/*
 * Search index — aggregates every public content item across every
 * surface into one flat list. Built server-side per request from the
 * live DB so the Cmd-K palette always reflects current vault state,
 * not the stale lib/data/* seed.
 *
 * Wrapped in React's `cache()` so requests that fan out to multiple
 * components (e.g. the search palette and the sitemap in the same
 * SSR pass) share the same fetch result.
 */

import 'server-only';
import { cache } from 'react';
import { getNotebookPosts, getNotebookThreads } from './notebook';
import { getBooks } from './library';
import { getProjects } from './projects';
import { getCourses } from './courses';
import { getWriteups } from './writeups';
import { getCredentials } from './credentials';
import { getLifePrinciples, getChangedMyMind } from './life';
import { getMasterPlanParts } from './master-plan';
import { getTasks } from './tasks';
import { getIdeas } from './ideas';
import { getLivingEntries } from './living';
import { FOOD_ITEMS } from './food';
/* Mental Models + Study remain archived. */

export type SurfaceKey =
  | 'notebook'
  | 'library'
  | 'projects'
  | 'mental-models'
  | 'courses'
  | 'writeups'
  | 'study'
  | 'credentials'
  | 'life'
  | 'ideas'
  | 'living'
  | 'food';

export interface SearchItem {
  surface: SurfaceKey;
  href: string;
  title: string;
  subtitle?: string;
  body?: string;
}

export const getSearchIndex = cache(async (): Promise<SearchItem[]> => {
  const [
    posts, threads, books, projects, courses, writeups, credentials,
    principles, changed, masterPlanParts, tasks, ideas, livingEntries,
  ] = await Promise.all([
    getNotebookPosts(), getNotebookThreads(),
    getBooks(), getProjects(), getCourses(), getWriteups(), getCredentials(),
    getLifePrinciples(), getChangedMyMind(),
    getMasterPlanParts(), getTasks(), getIdeas(), getLivingEntries(),
  ]);

  const items: SearchItem[] = [];

  for (const p of posts) items.push({
    surface: 'notebook',
    href: `/notebook/${p.slug}`,
    title: p.title,
    subtitle: `${p.kind === 'essay' ? 'essay' : 'note'} · ${p.date}`,
    body: p.body,
  });
  for (const t of threads) items.push({
    surface: 'notebook',
    href: `/notebook/threads/${t.slug}`,
    title: t.name,
    subtitle: `thread · ${t.state}`,
    body: t.summary,
  });
  for (const b of books) items.push({
    surface: 'library',
    href: `/library/${b.slug}`,
    title: b.title,
    subtitle: `${b.author} · ${b.status}`,
    body: b.notes ?? b.review ?? '',
  });
  for (const p of projects) items.push({
    surface: 'projects',
    href: `/projects/${p.slug}`,
    title: p.title,
    subtitle: `${p.tagline} · ${p.status}`,
    body: p.currentState ?? '',
  });
  for (const c of courses) items.push({
    surface: 'courses',
    href: `/courses/${c.slug}`,
    title: c.code ? `${c.code} · ${c.title}` : c.title,
    subtitle: `${c.university} · ${c.status}`,
    body: c.body ?? '',
  });
  for (const w of writeups) items.push({
    surface: 'writeups',
    href: `/writeups/${w.slug}`,
    title: w.title,
    subtitle: w.kind === 'machine'
      ? `${w.platform ?? 'writeup'}${w.difficulty ? ' · ' + w.difficulty : ''}${w.status ? ' · ' + w.status : ''}`
      : `technique${w.category ? ' · ' + w.category : ''}`,
    body: w.body ?? '',
  });
  for (const c of credentials) items.push({
    surface: 'credentials',
    href: `/credentials/${c.slug}`,
    title: c.title,
    subtitle: [c.institution, c.year ? String(c.year) : null, c.type]
      .filter(Boolean).join(' · '),
    body: c.description ?? c.body ?? '',
  });
  for (const p of principles) items.push({
    surface: 'life',
    href: `/life#principle-${p.slug}`,
    title: p.title,
    subtitle: 'principle',
    body: p.manifesto,
  });
  for (const e of changed) items.push({
    surface: 'life',
    href: `/life/changed-my-mind#${e.slug}`,
    title: e.title,
    subtitle: `changed-my-mind · ${e.dateChanged}`,
    body: `${e.previous} ${e.next}`,
  });
  for (const m of masterPlanParts) items.push({
    surface: 'life',
    href: `/life/plan/${m.slug}`,
    title: m.title,
    subtitle: `master plan · part ${String(m.partNumber).padStart(2, '0')}`,
    body: m.body.slice(0, 600),
  });
  for (const t of tasks) items.push({
    surface: 'life',
    href: `/life/tasks#${t.slug}`,
    title: t.title,
    subtitle: `task · ${t.scope} · ${t.status}`,
    body: t.notes ?? undefined,
  });
  for (const i of ideas) items.push({
    surface: 'ideas',
    href: `/ideas/${i.slug}`,
    title: i.title,
    subtitle: `idea · ${i.status}`,
    body: i.summary,
  });
  /* Living entries — single-doc surfaces. Each is a top-level route,
     and the body is long enough that a slice of it is useful for the
     full-text portion of search. */
  for (const e of livingEntries) items.push({
    surface: 'living',
    href: `/${e.slug}`,
    title: e.title,
    subtitle: 'living',
    body: e.summary ? `${e.summary}\n\n${e.body.slice(0, 600)}` : e.body.slice(0, 600),
  });
  /* Food photos. Each dish is searchable by its label (so "biryani"
     surfaces the photo); the href carries the photo id as a hash so
     entries stay unique even when two dishes share a label. They all
     land on the gallery. */
  for (const f of FOOD_ITEMS) items.push({
    surface: 'food',
    href: `/food#${f.id}`,
    title: f.label,
    subtitle: 'food',
  });

  return items;
});
