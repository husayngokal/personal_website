/*
 * Comments getter — reader notes appear on a post once the author
 * accepts them via the Obsidian /submissions moderation queue (BRIEF
 * Part VI + XIII). RLS keeps the comments table closed off public
 * reads, so this module uses the admin client and runs server-side.
 *
 * Only the public-facing fields are returned (no email, IP hash, or
 * UA). Newest-first per the brief's "reader notes" treatment.
 */

import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';

export interface ReaderNote {
  id: string;
  body: string;
  name: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export async function getApprovedComments(postSlug: string): Promise<ReaderNote[]> {
  if (!isSupabaseConfigured()) return [];
  const db = getServerAdminClient();
  const { data, error } = await db
    .from('comments')
    .select('id, body, name, created_at, reviewed_at')
    .eq('post_slug', postSlug)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as ReaderNote[];
}
