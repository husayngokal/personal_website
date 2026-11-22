/*
 * Studio quick updates — the one-tap page.
 *
 * The things that change often and by a small amount (a chapter done, a
 * page reached, a past paper sat, a hike logged) should not need a form.
 * Every tap scores: the bar at the top moves with it. This page
 * lists them from Postgres and each button is a single request to
 * /api/studio/quick, which commits the edit to the vault.
 *
 * Gated by the Studio layout. Built to be opened on a phone. The watch
 * app reads the same data from /api/studio/state.
 */

import { getServerAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { loadQuickData } from '@/lib/studio/quick-data';
import { QuickBoard } from './QuickBoard';
import styles from '../studio.module.css';

export const dynamic = 'force-dynamic';

export default async function QuickPage() {
  if (!isSupabaseConfigured()) {
    return <p className={styles.error}>The database is not configured here.</p>;
  }
  const data = await loadQuickData(getServerAdminClient());

  return (
    <div>
      <p className={styles.crumb}><a href="/studio">Studio</a> / Quick</p>
      <h1 className={styles.h1}>Quick updates</h1>
      <QuickBoard initial={data} />
    </div>
  );
}
