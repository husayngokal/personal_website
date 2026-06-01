import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type { ResearchTopic, ResearchStatus } from '../types';

/*
 * Research topics — the live-bookmarks surface. Each row is one topic
 * the author is actively researching: a cluster of resources (papers,
 * articles, videos, repos, podcasts) plus working notes and open
 * questions, status-tracked from gathering through to shipped.
 *
 * Sort: status priority first (gathering > exploring > writing >
 * shipped > dormant), then started date desc within each bucket, then
 * slug asc. This puts the most active topics at the top of the index
 * without needing the author to manage ordering manually.
 */

const STATUS_PRIORITY: Record<ResearchStatus, number> = {
  gathering: 0,
  exploring: 1,
  writing:   2,
  shipped:   3,
  dormant:   4,
};

export async function getResearchTopics(): Promise<ResearchTopic[]> {
  if (!isSupabaseConfigured()) return [];
  const db = getServerAdminClient();
  const { data, error } = await db
    .from('research_topics')
    .select('*');
  if (error || !data) return [];
  return data.map(fromRow.researchTopic).sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 99;
    const pb = STATUS_PRIORITY[b.status] ?? 99;
    if (pa !== pb) return pa - pb;
    const da = a.started ?? '';
    const db = b.started ?? '';
    if (da !== db) return db.localeCompare(da);
    return a.slug.localeCompare(b.slug);
  });
}

export async function getResearchTopic(slug: string): Promise<ResearchTopic | null> {
  if (!isSupabaseConfigured()) return null;
  const db = getServerAdminClient();
  const { data, error } = await db
    .from('research_topics')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return fromRow.researchTopic(data);
}
