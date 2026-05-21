/*
 * Cross-surface link mechanics — slug registry + backlink lookup.
 *
 * The site has exactly one cross-surface linking mechanism per BRIEF
 * Part IV: wikilinks plus their inverse, backlinks. Both consume the
 * `wikilinks` table populated by the vault sync (lib/vault/sync.ts).
 *
 * The slug registry maps every public-page slug to its surface, title,
 * and URL. It exists so the markdown renderer can resolve [[slug]]
 * even when the source and target sit in different surfaces. Registry
 * is cached for the lifetime of one request via React's `cache()`.
 *
 * The backlinks getter returns the list of pages that reference a
 * given (table, slug) pair. The wikilinks table already carries the
 * source title and URL denormalised, so this is one SELECT per
 * page render — no follow-up joins.
 */

import 'server-only';
import { cache } from 'react';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { buildRegistry, type SlugRegistryEntry } from '../wikilinks';

export interface Backlink {
  source_table: string;
  source_slug: string;
  source_title: string;
  source_url: string;
  link_text: string | null;
}

/* Tables + columns to pull when assembling the registry. Each row
   contributes { table, slug, title, url } to a single flat list. */
const REGISTRY_TABLES = [
  { table: 'notebook_posts',       cols: 'slug, title' },
  { table: 'notebook_threads',     cols: 'slug, name'  },
  { table: 'library_books',        cols: 'slug, title' },
  { table: 'projects',             cols: 'slug, title' },
  { table: 'mental_models',        cols: 'slug, title' },
  { table: 'courses',              cols: 'slug, title' },
  { table: 'writeups',             cols: 'slug, title' },
  { table: 'credentials',          cols: 'slug, title' },
  { table: 'study_credentials',    cols: 'slug, title' },
  { table: 'study_domains',        cols: 'slug, title' },
  { table: 'life_principles',      cols: 'slug, title' },
  { table: 'life_changed_mind',    cols: 'slug, title' },
  { table: 'life_story_vignettes', cols: 'slug, title' },
] as const;

export const getSlugRegistry = cache(async () => {
  /* Degrade gracefully when Supabase isn't configured (e.g. a preview
     build without env vars), exactly like every other getter. An empty
     registry means wikilinks render as plain text rather than crashing
     the prerender of any page that calls renderMarkdown. */
  if (!isSupabaseConfigured()) return buildRegistry([]);
  const db = getServerAdminClient();
  const flat: SlugRegistryEntry[] = [];
  await Promise.all(REGISTRY_TABLES.map(async ({ table, cols }) => {
    const { data } = await db.from(table).select(cols);
    for (const r of (data ?? []) as { slug: string; title?: string; name?: string }[]) {
      const slug = r.slug;
      const title = r.title ?? r.name ?? slug;
      const url = urlForTable(table, slug);
      if (!url) continue;
      flat.push({ table, slug, title, url });
    }
  }));
  return buildRegistry(flat);
});

function urlForTable(table: string, slug: string): string | null {
  // Mirrors lib/wikilinks.urlFor — kept here to avoid an import cycle
  // (wikilinks is also imported from sync.ts on the server-edge).
  switch (table) {
    case 'notebook_posts':       return `/notebook/${slug}`;
    case 'notebook_threads':     return `/notebook/threads/${slug}`;
    case 'library_books':        return `/library/${slug}`;
    case 'projects':             return `/projects/${slug}`;
    case 'mental_models':        return `/mental-models/${slug}`;
    case 'courses':              return `/courses/${slug}`;
    case 'writeups':             return `/writeups/${slug}`;
    case 'credentials':          return `/credentials/${slug}`;
    case 'study_credentials':    return `/study/credentials/${slug}`;
    case 'study_domains':        return `/study/domains/${slug}`;
    case 'life_principles':      return `/life#principle-${slug}`;
    case 'life_changed_mind':    return `/life/changed-my-mind#${slug}`;
    case 'life_story_vignettes': return `/life#story-${slug}`;
    default: return null;
  }
}

/* Pages that reference (table, slug). One SELECT, ordered by source
   table then title for predictable display. */
export async function getBacklinks(table: string, slug: string): Promise<Backlink[]> {
  if (!isSupabaseConfigured()) return [];
  const db = getServerAdminClient();
  const { data, error } = await db
    .from('wikilinks')
    .select('source_table, source_slug, source_title, source_url, link_text')
    .eq('target_table', table)
    .eq('target_slug', slug)
    .order('source_table', { ascending: true })
    .order('source_title', { ascending: true });
  if (error || !data) return [];
  /* Drop rows missing the denormalised display fields — they belong
     to a pre-0006-migration sync and would render blank. */
  return data.filter((r) => r.source_title && r.source_url) as Backlink[];
}
