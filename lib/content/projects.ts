import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type { ProjectPage } from '../types';
import { PROJECTS as PROJECTS_FALLBACK } from '../data/projects';

export async function getProjects(): Promise<ProjectPage[]> {
  if (!isSupabaseConfigured()) return PROJECTS_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db.from('projects').select('*');
  return (data ?? []).map(fromRow.project);
}

export async function getProject(slug: string): Promise<ProjectPage | null> {
  if (!isSupabaseConfigured()) return PROJECTS_FALLBACK.find((p) => p.slug === slug) ?? null;
  const db = getServerAdminClient();
  const { data } = await db.from('projects').select('*').eq('slug', slug).maybeSingle();
  return data ? fromRow.project(data) : null;
}
