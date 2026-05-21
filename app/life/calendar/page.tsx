import { Eyebrow } from '@/components/Primitives';
import { LifeGrid } from '@/components/LifeGrid';
import { LifeTickers } from '@/components/LifeTickers';
import { BIRTH_ISO, GRID_YEARS, GRID_WEEKS, lifeCounters } from '@/lib/memento';
import styles from './calendar.module.css';

/*
 * Life calendar — "Your Life in Weeks" grid + a set of live
 * Vsauce-style counters underneath. The site's most direct
 * memento mori (BRIEF Part I).
 *
 * Grid: 70 rows × 52 cells. Each cell is one week. Filled cells
 * are weeks lived; one cell pulses in orange — the current week.
 * 70 years is a convention, not a prediction (Tim Urban's variant
 * uses 90; this site's variant is shorter, closer to a working life).
 * Viewers project their own line onto it.
 *
 * Counters: seconds / minutes / hours / days / weeks / months /
 * years. Seconds ticks live. The other counts re-render off the
 * same animation frame so they stay in sync without per-counter
 * intervals.
 */

export const metadata = {
  title: 'A life in weeks',
  description: 'Memento mori. The work is temporary.',
};

export const dynamic = 'force-dynamic';

export default function LifeCalendarPage() {
  /* Server-side snapshot so first paint shows real numbers
     (avoids the "0 0 0 0 0" flash before client hydrates). */
  const initial = lifeCounters();

  return (
    <div className="page" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <Eyebrow number="11">Life Plan · Calendar</Eyebrow>
        <h1 className={styles.title}>A life in weeks.</h1>
        <p className={styles.dek}>
          {GRID_YEARS} years &times; 52 weeks. Each square is one week.
          Filled squares are weeks lived; the orange square is the week
          you&rsquo;re reading this in. The grid is a convention, not a
          prediction &mdash; sit with it however you sit with it.
        </p>
      </header>

      <LifeGrid initial={initial} />

      <section className={styles.counters}>
        <p className={styles.countersLabel}>Counters</p>
        <LifeTickers initial={initial} />
      </section>

      <footer className={styles.footer}>
        <p className={styles.epitaph}>
          Born {new Date(BIRTH_ISO).toLocaleDateString('en-GB', {
            year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Dubai',
          })}. {GRID_WEEKS.toLocaleString()} squares on this page; the
          actual number known to no one.
        </p>
        <p className={styles.mori}>memento mori.</p>
      </footer>
    </div>
  );
}
