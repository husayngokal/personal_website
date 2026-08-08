/*
 * Current author employment — feeds the homepage now-state "currently
 * working" line.
 *
 * Stored as one row in current_state with key='current_working', shape
 * { company, url, role, started, location, arrangement, blurb }. Set from
 * the vault file now/working.md (parsed by lib/vault/parse.ts, upserted by
 * lib/vault/sync.ts) so the author edits it in Obsidian like everything
 * else. Returns null when unset so the homepage simply omits the line
 * rather than rendering an empty element.
 */

import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';

export interface CurrentWorking {
  company: string | null;
  url: string | null;
  role: string;
  started: string | null;
  location: string | null;
  arrangement: string | null;
  blurb: string | null;
}

export async function getCurrentWorking(): Promise<CurrentWorking | null> {
  if (!isSupabaseConfigured()) return null;
  const db = getServerAdminClient();
  const { data } = await db
    .from('current_state')
    .select('value')
    .eq('key', 'current_working')
    .maybeSingle();
  const v = (data?.value ?? null) as Partial<CurrentWorking> | null;
  /* role is the one required field; without it there's nothing to say. */
  if (!v || !v.role) return null;
  return {
    company: v.company ?? null,
    url: v.url ?? null,
    role: v.role,
    started: v.started ?? null,
    location: v.location ?? null,
    arrangement: v.arrangement ?? null,
    blurb: v.blurb ?? null,
  };
}
