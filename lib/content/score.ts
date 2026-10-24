import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { readScore } from '../score/store';
import type { ScoreState } from '../score/compute';

/* The stored score (see lib/score/store.ts). Null before the first sync
   that knows how to score, or without a database. */
export async function getScoreState(): Promise<ScoreState | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    return await readScore(getServerAdminClient());
  } catch {
    return null;
  }
}
