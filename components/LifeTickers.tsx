'use client';

import { useEffect, useState } from 'react';
import { lifeCounters, type LifeCounters } from '@/lib/memento';
import styles from './LifeTickers.module.css';

/*
 * Live counters under the life grid. Seconds tick at ~10Hz so the
 * number feels continuously alive (matching Vsauce's clock-counter
 * register); minutes / hours / days etc. all derive from the same
 * state, so they update on the same animation frame.
 *
 * `prefers-reduced-motion` drops the per-tick render to once per
 * second so the screen doesn't flicker for motion-sensitive viewers.
 */

const HIGH_FREQ_MS = 100;     // 10Hz when motion is allowed
const LOW_FREQ_MS  = 1000;    // 1Hz under prefers-reduced-motion

export function LifeTickers({ initial }: { initial: LifeCounters }) {
  const [counters, setCounters] = useState(initial);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const interval = reduce ? LOW_FREQ_MS : HIGH_FREQ_MS;
    const tick = () => setCounters(lifeCounters());
    tick();
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, []);

  return (
    <dl className={styles.tickers}>
      <Ticker label="Years"   value={counters.years.toFixed(7)} />
      <Ticker label="Months"  value={counters.months.toLocaleString()} />
      <Ticker label="Weeks"   value={counters.weeks.toLocaleString()} />
      <Ticker label="Days"    value={counters.days.toLocaleString()} />
      <Ticker label="Hours"   value={counters.hours.toLocaleString()} />
      <Ticker label="Minutes" value={counters.minutes.toLocaleString()} />
      <Ticker label="Seconds" value={counters.seconds.toLocaleString()} highlight />
    </dl>
  );
}

function Ticker({
  label, value, highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`${styles.row} ${highlight ? styles.rowHighlight : ''}`}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
    </div>
  );
}
