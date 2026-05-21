import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type { NotebookPost, NotebookThread } from '../types';
import {
  NOTEBOOK_POSTS as POSTS_FALLBACK,
  NOTEBOOK_THREADS as THREADS_FALLBACK,
} from '../data/notebook';

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
  const { data } = await db.from('notebook_posts').select('*').eq('slug', slug).maybeSingle();
  return data ? fromRow.notebookPost(data) : null;
}

export async function getNotebookThreads(): Promise<NotebookThread[]> {
  if (!isSupabaseConfigured()) return THREADS_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db.from('notebook_threads').select('*');
  return (data ?? []).map(fromRow.notebookThread);
}

export async function getNotebookThread(slug: string): Promise<NotebookThread | null> {
  if (!isSupabaseConfigured()) return THREADS_FALLBACK.find((t) => t.slug === slug) ?? null;
  const db = getServerAdminClient();
  const { data } = await db.from('notebook_threads').select('*').eq('slug', slug).maybeSingle();
  return data ? fromRow.notebookThread(data) : null;
}

export async function getPostsInThread(slug: string): Promise<NotebookPost[]> {
  const posts = await getNotebookPosts();
  return posts.filter((p) => p.thread === slug);
}
