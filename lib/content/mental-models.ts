import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type { MentalModel } from '../types';
import { MENTAL_MODELS as MODELS_FALLBACK } from '../data/mental-models';

export async function getMentalModels(): Promise<MentalModel[]> {
  if (!isSupabaseConfigured()) return MODELS_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db.from('mental_models').select('*');
  return (data ?? []).map(fromRow.mentalModel);
}

export async function getMentalModel(slug: string): Promise<MentalModel | null> {
  if (!isSupabaseConfigured()) return MODELS_FALLBACK.find((m) => m.slug === slug) ?? null;
  const db = getServerAdminClient();
  const { data } = await db.from('mental_models').select('*').eq('slug', slug).maybeSingle();
  return data ? fromRow.mentalModel(data) : null;
}
