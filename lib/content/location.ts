/*
 * Current author location — feeds the top nav's status pulse.
 *
 * Stored as one row in current_state with key='current_location',
 * shape { city, country, timezone }. Updated via:
 *   - POST /api/location  (Bearer-auth'd; ideal for an iOS Shortcut
 *     that fires on a significant location change)
 *   - Direct SQL in the Supabase dashboard
 *   - Eventually: a life/location.md file in the vault, parsed by
 *     sync.ts (not wired in this commit)
 *
 * Default falls back to Sharjah / Asia/Dubai so the nav never renders
 * blank, even on fresh deploys before the migration has been applied.
 */

import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';

export interface CurrentLocation {
  city: string;
  country?: string;
  timezone: string;        // IANA timezone, e.g. 'Asia/Dubai'
}

export const DEFAULT_LOCATION: CurrentLocation = {
  city: 'Sharjah',
  country: 'United Arab Emirates',
  timezone: 'Asia/Dubai',
};

export async function getCurrentLocation(): Promise<CurrentLocation> {
  if (!isSupabaseConfigured()) return DEFAULT_LOCATION;
  const db = getServerAdminClient();
  const { data } = await db
    .from('current_state')
    .select('value')
    .eq('key', 'current_location')
    .maybeSingle();
  const v = (data?.value ?? {}) as Partial<CurrentLocation>;
  if (!v.city || !v.timezone) return DEFAULT_LOCATION;
  return { city: v.city, country: v.country, timezone: v.timezone };
}
