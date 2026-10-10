/*
 * Studio quick updates — the one-tap page.
 *
 * The things that change often and by a small amount (a book's progress,
 * a task getting done, a hike logged) should not need a form. This page
 * lists them from Postgres and each button is a single request to
 * /api/studio/quick, which commits the edit to the vault.
 *
 * Gated by the Studio layout. Built to be opened on a phone.
 */

import { getServerAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { getActivityDays } from '@/lib/content/vault-state';
import { listDoneItems } from '@/lib/vault/done-items';
import { QuickBoard, type QuickData } from './QuickBoard';
import styles from '../studio.module.css';

export const dynamic = 'force-dynamic';

export default async function QuickPage() {
  if (!isSupabaseConfigured()) {
    return <p className={styles.error}>The database is not configured here.</p>;
  }
  const db = getServerAdminClient();
  const [books, tasks, projects, atlas, days] = await Promise.all([
    db.from('library_books').select('slug,title,author,status,progress_pct')
      .eq('status', 'reading').order('progress_pct', { ascending: false, nullsFirst: false }),
    db.from('tasks').select('slug,title,status,scope,priority,category')
      .in('status', ['open', 'in-progress', 'blocked'])
      .order('priority', { ascending: true, nullsFirst: false }).order('ordinal', { ascending: true, nullsFirst: false }),
    db.from('projects').select('slug,title,status,last_active,last_edited_at').eq('status', 'active'),
    db.from('living_entries').select('slug,title,body').eq('slug', 'field-atlas').maybeSingle(),
    getActivityDays(db),
  ]);

  const data: QuickData = {
    books: (books.data ?? []).map((b) => ({
      slug: b.slug, title: b.title, author: b.author, status: b.status, progressPct: b.progress_pct ?? 0,
    })),
    tasks: (tasks.data ?? []).map((t) => ({
      slug: t.slug, title: t.title, status: t.status, scope: t.scope, category: t.category ?? null,
    })),
    projects: (projects.data ?? []).map((p) => ({
      slug: p.slug, title: p.title,
      lastActive: (p.last_edited_at ?? p.last_active ?? null) as string | null,
    })),
    atlas: atlas.data
      ? { slug: atlas.data.slug, title: atlas.data.title, groups: listDoneItems(atlas.data.body ?? '') }
      : null,
    activeDays: days,
  };

  return (
    <div>
      <p className={styles.crumb}><a href="/studio">Studio</a> / Quick</p>
      <h1 className={styles.h1}>Quick updates</h1>
      <QuickBoard initial={data} />
    </div>
  );
}
