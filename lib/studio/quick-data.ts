/*
 * The Quick board's data, read from Postgres in one go. Shared by the
 * Studio quick page (rendered on the server) and /api/studio/state (the
 * watch app), so both always show the same plate.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listDoneItems } from '@/lib/vault/done-items';
import { readScore } from '@/lib/score/store';
import { IDLE, TIMER_KEY, type TimerNow } from '@/lib/score/time';
import { REFRESH_KEY } from '@/lib/score/needs';
import type { QuickData } from '@/app/studio/quick/QuickBoard';

export async function loadQuickData(db: SupabaseClient): Promise<QuickData> {
  const [tasks, projects, atlas, score, timerRow, refreshRow] = await Promise.all([
    db.from('tasks').select('slug,title,status,scope,priority,category,recurrence')
      .in('status', ['open', 'in-progress', 'blocked'])
      .order('priority', { ascending: true, nullsFirst: false }).order('ordinal', { ascending: true, nullsFirst: false }),
    db.from('projects').select('slug,title,status').in('status', ['active', 'paused', 'dormant']).order('title'),
    db.from('living_entries').select('slug,title,body').eq('slug', 'field-atlas').maybeSingle(),
    readScore(db),
    db.from('current_state').select('value').eq('key', TIMER_KEY).maybeSingle(),
    db.from('current_state').select('value').eq('key', REFRESH_KEY).maybeSingle(),
  ]);

  return {
    tasks: (tasks.data ?? []).map((t) => ({
      slug: t.slug, title: t.title, status: t.status, scope: t.scope, category: t.category ?? null,
      recurrence: t.recurrence ?? null,
    })),
    projects: (projects.data ?? []).map((p) => ({
      slug: p.slug, title: p.title, status: p.status,
    })),
    atlas: atlas.data
      ? { slug: atlas.data.slug, title: atlas.data.title, groups: listDoneItems(atlas.data.body ?? '') }
      : null,
    score,
    timer: { ...IDLE, ...((timerRow.data?.value as Partial<TimerNow> | undefined) ?? {}) },
    refreshAt: (refreshRow.data?.value as { at?: string } | undefined)?.at ?? null,
  };
}
