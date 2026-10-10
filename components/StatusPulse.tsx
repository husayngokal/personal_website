'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { lifeCounters } from '@/lib/memento';
import styles from './StatusPulse.module.css';

/*
 * Status pulse — a quiet week-of-life counter in the top nav (the
 * memento mori thread that runs through every page, per BRIEF Part I).
 *
 * The count links to /life/calendar (the full grid + live counters);
 * the click is the visitor's invitation to sit with the number for a
 * moment longer.
 *
 * Refreshes every 20s so a week roll-over is caught without a reload.
 * Computed client-side only, so the server render is empty and there
 * is no hydration mismatch on the number.
 */

export function StatusPulse() {
  const [week, setWeek] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setWeek(lifeCounters(Date.now()).weekOfLife);
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);

  if (week === null) return null;

  return (
    <div className={styles.status}>
      <Link
        href="/life/calendar"
        className={styles.week}
        aria-label={`Week ${week.toLocaleString()} of life`}
      >
        week {week.toLocaleString()}
      </Link>
    </div>
  );
}
