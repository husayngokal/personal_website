import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type { Task } from '../types';
import { TASKS as FALLBACK } from '../data/tasks';

/*
 * Public tasks — what the author is actively working on, accountability
 * exposed. Standard Postgres-or-fallback pattern. Sort order: scope
 * urgency (today first, lifetime last) then ordinal then title.
 */

const SCOPE_RANK: Record<string, number> = {
  'today': 0, 'this-week': 1, 'this-month': 2,
  'this-quarter': 3, 'this-year': 4, 'lifetime': 5,
};

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const sa = SCOPE_RANK[a.scope] ?? 99;
    const sb = SCOPE_RANK[b.scope] ?? 99;
    if (sa !== sb) return sa - sb;
    const oa = a.ordinal ?? 100;
    const ob = b.ordinal ?? 100;
    if (oa !== ob) return oa - ob;
    return a.title.localeCompare(b.title);
  });
}

export async function getTasks(): Promise<Task[]> {
  if (!isSupabaseConfigured()) return sortTasks(FALLBACK);
  const db = getServerAdminClient();
  const { data, error } = await db.from('tasks').select('*');
  if (error || !data || data.length === 0) return sortTasks(FALLBACK);
  return sortTasks(data.map(fromRow.task));
}
