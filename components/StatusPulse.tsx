'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sun } from './marks/Sun';
import { Moon } from './marks/Moon';
import { lifeCounters } from '@/lib/memento';
import styles from './StatusPulse.module.css';

/*
 * Status pulse — author's current location, local time, sun/moon mark,
 * and a quiet week-of-life counter (the memento mori thread that runs
 * through every page, per BRIEF Part I).
 *
 * City + timezone are server-fetched from current_state via the
 * RootLayout (lib/content/location), so editing the row updates the
 * nav site-wide. Defaults to Sharjah / Asia/Dubai if the row is
 * empty or props aren't passed.
 *
 * The week-of-life count links to /life/calendar (the full grid +
 * live counters); the click is the visitor's invitation to sit with
 * the number for a moment longer.
 *
 * All counters refresh every 20s — granular enough to feel alive
 * without churn; catches day↔night transition and week roll-overs
 * without a hard reload.
 */

const DEFAULT_CITY = 'Sharjah';
const DEFAULT_TZ   = 'Asia/Dubai';

export interface StatusPulseProps {
  city?: string;
  timezone?: string;
}

function formatTime(date: Date, tz: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  // "11:47 pm" — collapse the space and lowercase
  return formatter.format(date).replace(/\s/g, '').toLowerCase();
}

/* Local hour in the author's timezone, 0-23. Used to pick sun vs
   moon — anything from 06:00 up to (but not including) 18:00 is
   "day". The dawn/dusk windows could use sunrise/sunset tables
   later; the six-o'clock approximation is fine for v1. */
function localHour(date: Date, tz: string): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', hour12: false,
  }).format(date);
  return parseInt(h, 10);
}

export function StatusPulse({ city, timezone }: StatusPulseProps = {}) {
  const c  = city || DEFAULT_CITY;
  const tz = timezone || DEFAULT_TZ;

  const [time, setTime]     = useState<string | null>(null);
  const [isDay, setIsDay]   = useState<boolean | null>(null);
  const [week, setWeek]     = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(formatTime(now, tz));
      const h = localHour(now, tz);
      setIsDay(h >= 6 && h < 18);
      setWeek(lifeCounters(now.getTime()).weekOfLife);
    };
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, [tz]);

  return (
    <div className={styles.status} aria-label={`Author location: ${c}`}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.city}>{c}</span>
      {isDay !== null && (
        <span className={styles.celestial} aria-hidden="true">
          {isDay ? <Sun size={13} /> : <Moon size={13} />}
        </span>
      )}
      {time && <span className={styles.sep} aria-hidden="true">·</span>}
      {time && <span className={styles.time}>{time}</span>}
      {week !== null && <span className={styles.sep} aria-hidden="true">·</span>}
      {week !== null && (
        <Link
          href="/life/calendar"
          className={styles.week}
          aria-label={`Week ${week.toLocaleString()} of life`}
        >
          week {week.toLocaleString()}
        </Link>
      )}
    </div>
  );
}
