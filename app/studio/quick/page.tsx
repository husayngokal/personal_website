/*
 * Studio quick updates — the one-tap page.
 *
 * The things that change often and by a small amount (a chapter done, a
 * page reached, a past paper sat, a hike logged) should not need a form.
 * Every tap scores: the bar at the top moves with it. This page
 * lists them from Postgres and each button is a single request to
 * /api/studio/quick, which commits the edit to the vault.
 *
 * Gated by the Studio layout. Built to be opened on a phone.
 */

import { getServerAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { listDoneItems } from '@/lib/vault/done-items';
import { readScore } from '@/lib/score/store';
import { QuickBoard, type QuickData } from './QuickBoard';
import styles from '../studio.module.css';

export const dynamic = 'force-dynamic';

export default async function QuickPage() {
  if (!isSupabaseConfigured()) {
    return <p className={styles.error}>The database is not configured here.</p>;
  }
  const db = getServerAdminClient();
  const [tasks, projects, atlas, score] = await Promise.all([
    db.from('tasks').select('slug,title,status,scope,priority,category,recurrence')
      .in('status', ['open', 'in-progress', 'blocked'])
      .order('priority', { ascending: true, nullsFirst: false }).order('ordinal', { ascending: true, nullsFirst: false }),
    db.from('projects').select('slug,title,status').in('status', ['active', 'paused', 'dormant']).order('title'),
    db.from('living_entries').select('slug,title,body').eq('slug', 'field-atlas').maybeSingle(),
    readScore(db),
  ]);

  const data: QuickData = {
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
  };

  return (
    <div>
      <p className={styles.crumb}><a href="/studio">Studio</a> / Quick</p>
      <h1 className={styles.h1}>Quick updates</h1>
      <QuickBoard initial={data} />
    </div>
  );
}
