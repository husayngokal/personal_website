import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type { Course } from '../types';

export async function getCourses(): Promise<Course[]> {
  if (!isSupabaseConfigured()) return [];
  const db = getServerAdminClient();
  const { data } = await db
    .from('courses').select('*')
    .order('order_', { ascending: true })
    .order('university', { ascending: true })
    .order('code', { ascending: true });
  return (data ?? []).map(fromRow.course);
}

export async function getCourse(slug: string): Promise<Course | null> {
  if (!isSupabaseConfigured()) return null;
  const db = getServerAdminClient();
  const { data } = await db.from('courses').select('*').eq('slug', slug).maybeSingle();
  return data ? fromRow.course(data) : null;
}
