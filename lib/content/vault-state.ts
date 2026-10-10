/*
 * Bookkeeping rows in current_state.
 *
 * current_state is a key/value table, so new kinds of state need no
 * migration (the Supabase dashboard is locked out, see CLAUDE.md). Two
 * rows live here beside the currently_* live state:
 *
 *   vault_paths    { paths: { <table>: { <slug>: <vault path> } } }
 *   activity_days  { days: ['YYYY-MM-DD', ...] }   author's timezone
 *
 * Both are written by the vault sync. The live-state readers ignore keys
 * they do not know, so these never reach the typewriter or the plates.
 *
 * No 'server-only' import: the sync is also run by plain tsx scripts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { authorDay } from './streak';

export const PATHS_KEY = 'vault_paths';
export const ACTIVITY_KEY = 'activity_days';

/** Upsert a current_state row only if its value actually changed. Every
 *  write is broadcast over Realtime to open homepages, so a no-op sync
 *  should stay silent. Returns true when a write happened. */
export async function writeStateIfChanged(db: SupabaseClient, key: string, value: object): Promise<boolean> {
  const { data } = await db.from('current_state').select('value').eq('key', key).maybeSingle();
  if (data && JSON.stringify(data.value) === JSON.stringify(value)) return false;
  const { error } = await db
    .from('current_state')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(`${key}: ${error.message}`);
  return true;
}

export async function getVaultPath(db: SupabaseClient, table: string, slug: string): Promise<string | null> {
  const { data } = await db.from('current_state').select('value').eq('key', PATHS_KEY).maybeSingle();
  const paths = (data?.value as { paths?: Record<string, Record<string, string>> } | undefined)?.paths;
  return paths?.[table]?.[slug] ?? null;
}

export async function getActivityDays(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from('current_state').select('value').eq('key', ACTIVITY_KEY).maybeSingle();
  const days = (data?.value as { days?: unknown } | undefined)?.days;
  return Array.isArray(days) ? days.filter((d): d is string => typeof d === 'string') : [];
}

/** Count today as active straight away, without waiting for the next sync
 *  to re-read the commit history. */
export async function markActiveToday(db: SupabaseClient): Promise<void> {
  const today = authorDay();
  const days = await getActivityDays(db);
  if (days.includes(today)) return;
  await writeStateIfChanged(db, ACTIVITY_KEY, { days: [...days, today].sort() });
}
