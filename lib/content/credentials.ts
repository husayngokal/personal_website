import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type { Credential } from '../types';

/*
 * Credentials getter — publicly downloadable academic + professional
 * documents. RLS allows anonymous SELECT for is_public=true rows; the
 * admin client bypasses that for parity with other surfaces and gives
 * us the option to surface private credentials behind auth later.
 *
 * Public-facing pages MUST filter by `isPublic === true` before
 * rendering — the table can legitimately hold private entries (e.g.
 * payslips, tax filings) that should never reach the visitor.
 */

export async function getCredentials(): Promise<Credential[]> {
  if (!isSupabaseConfigured()) return [];
  const db = getServerAdminClient();
  const { data } = await db
    .from('credentials')
    .select('*')
    .eq('is_public', true)
    .order('year', { ascending: false, nullsFirst: false })
    .order('slug', { ascending: true });
  return (data ?? []).map(fromRow.credential);
}

export async function getCredential(slug: string): Promise<Credential | null> {
  if (!isSupabaseConfigured()) return null;
  const db = getServerAdminClient();
  const { data } = await db
    .from('credentials')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .maybeSingle();
  return data ? fromRow.credential(data) : null;
}

/** Resolve a stored file_path against NEXT_PUBLIC_VAULT_MEDIA_URL. */
export function credentialFileUrl(filePath: string): string {
  const base = (process.env.NEXT_PUBLIC_VAULT_MEDIA_URL || 'https://media.husayngokal.com').replace(/\/+$/, '');
  /* Single-pass URI encode of each path segment; leaves slashes intact. */
  const safe = filePath.split('/').map(encodeURIComponent).join('/');
  return `${base}/${safe}`;
}
