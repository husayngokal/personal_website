import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type { NotebookPost } from '../types';
import { NOTEBOOK_POSTS as POSTS_FALLBACK } from '../data/notebook';

/*
 * Notebook getters. The surface is essays only, so there is no kind to
 * filter on and no thread to join. `draft` is the single gate: a post
 * with draft: true exists in Postgres but is invisible everywhere
 * public, including at its own URL. Both getters below enforce that, so
 * a draft cannot leak through a guessed slug.
 */

export async function getNotebookPosts(): Promise<NotebookPost[]> {
  if (!isSupabaseConfigured()) return POSTS_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db
    .from('notebook_posts').select('*').eq('draft', false)
    .order('date', { ascending: false });
  return (data ?? []).map(fromRow.notebookPost);
}

export async function getNotebookPost(slug: string): Promise<NotebookPost | null> {
  if (!isSupabaseConfigured()) return POSTS_FALLBACK.find((p) => p.slug === slug) ?? null;
  const db = getServerAdminClient();
  /* draft filter is deliberate — without it a draft renders for anyone
     who knows the slug, while being absent from the index, the sitemap,
     the RSS feed and Cmd-K search. Unpublished means unpublished. */
  const { data } = await db
    .from('notebook_posts').select('*').eq('slug', slug).eq('draft', false)
    .maybeSingle();
  return data ? fromRow.notebookPost(data) : null;
}
