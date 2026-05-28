import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type { LivingEntry } from '../types';

/*
 * Living entries — long-form documents for the Living menu group
 * (bucket list, field atlas, anything else of that shape).
 *
 * Each entry lives at /<slug> as a top-level route. Routes are
 * explicit rather than [slug] so each one can carry its own metadata
 * and per-page treatment as the docs mature.
 *
 * Listing returns entries in order_idx asc (then slug asc), so the
 * frontmatter `order:` field controls the menu sequence when multiple
 * entries surface together.
 */

export async function getLivingEntries(): Promise<LivingEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const db = getServerAdminClient();
  const { data, error } = await db
    .from('living_entries')
    .select('*')
    .order('order_idx', { ascending: true })
    .order('slug',      { ascending: true });
  if (error || !data) return [];
  return data.map(fromRow.livingEntry);
}

export async function getLivingEntry(slug: string): Promise<LivingEntry | null> {
  if (!isSupabaseConfigured()) return null;
  const db = getServerAdminClient();
  const { data, error } = await db
    .from('living_entries')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return fromRow.livingEntry(data);
}
