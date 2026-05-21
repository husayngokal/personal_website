import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type { Writeup } from '../types';

/*
 * Writeups getter — pulls every public writeup. RLS allows anonymous
 * SELECT (the table's "public read writeups" policy), but we use the
 * admin client to bypass any future per-row visibility logic without
 * refactoring this module.
 *
 * Sorted by date desc with a slug tiebreaker so order is deterministic
 * even when multiple writeups share a publication date.
 */

export async function getWriteups(): Promise<Writeup[]> {
  if (!isSupabaseConfigured()) return [];
  const db = getServerAdminClient();
  const { data } = await db
    .from('writeups')
    .select('*')
    .order('date', { ascending: false, nullsFirst: false })
    .order('slug', { ascending: true });
  return (data ?? []).map(fromRow.writeup);
}

export async function getWriteup(slug: string): Promise<Writeup | null> {
  if (!isSupabaseConfigured()) return null;
  const db = getServerAdminClient();
  const { data } = await db
    .from('writeups')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return data ? fromRow.writeup(data) : null;
}
