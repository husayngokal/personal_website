import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type { MasterPlanPart } from '../types';
import { MASTER_PLAN_PARTS as FALLBACK } from '../data/master-plan';

/*
 * Master Plan — the operating document for the entire life, 18 Parts
 * imported from the author's 883-page working PDF into the vault as
 * one .md per Part. The vault syncer upserts to life_master_plan; this
 * module reads back through the standard Postgres-or-fallback pattern
 * used by every other content surface.
 *
 * Listing returns Parts in part_number order. Individual lookups by
 * slug return the full body markdown for the detail page to render.
 */

export async function getMasterPlanParts(): Promise<MasterPlanPart[]> {
  if (!isSupabaseConfigured()) return FALLBACK;
  const db = getServerAdminClient();
  const { data, error } = await db
    .from('life_master_plan')
    .select('*')
    .order('part_number', { ascending: true });
  if (error || !data || data.length === 0) return FALLBACK;
  return data.map(fromRow.masterPlanPart);
}

export async function getMasterPlanPart(slug: string): Promise<MasterPlanPart | null> {
  const parts = await getMasterPlanParts();
  return parts.find((p) => p.slug === slug) ?? null;
}
