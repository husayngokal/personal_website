import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type { Idea } from '../types';
import { IDEAS as FALLBACK } from '../data/ideas';

/*
 * Ideas — proposal log for the website itself and adjacent projects.
 * Standard Postgres-or-fallback pattern. Newest first within each
 * status; status ordering is open > exploring > building > shipped
 * > dropped, so the live ones lead the page and the dropped ones
 * stay at the bottom as historical record.
 */

const STATUS_RANK: Record<string, number> = {
  open: 0, exploring: 1, building: 2, shipped: 3, dropped: 4,
};

function sortIdeas(ideas: Idea[]): Idea[] {
  return [...ideas].sort((a, b) => {
    const sa = STATUS_RANK[a.status] ?? 99;
    const sb = STATUS_RANK[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    return b.proposed.localeCompare(a.proposed);
  });
}

export async function getIdeas(): Promise<Idea[]> {
  if (!isSupabaseConfigured()) return sortIdeas(FALLBACK);
  const db = getServerAdminClient();
  const { data, error } = await db.from('ideas').select('*');
  if (error || !data || data.length === 0) return sortIdeas(FALLBACK);
  return sortIdeas(data.map(fromRow.idea));
}

export async function getIdea(slug: string): Promise<Idea | null> {
  const all = await getIdeas();
  return all.find((i) => i.slug === slug) ?? null;
}
