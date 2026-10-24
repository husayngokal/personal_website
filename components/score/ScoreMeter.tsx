'use client';

/*
 * The meter: this week's number out of the bar, the bar itself (quests
 * then curiosity, both solid orange, split by a hairline), and three
 * figures: level, lifetime, full weeks in a row. Nothing else.
 *
 * Presentational. The number rolls up when it rises and the bar flares as
 * it fills; both settle instantly under prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from 'react';
import { useCountUp } from './useCountUp';
import styles from './ScoreMeter.module.css';

export interface MeterWeek { bar: number; quest: number; curiosityCounted: number; full: boolean; extra: number }

export function ScoreMeter({
  week, barMax, cap, level, lifetime, streak, compact = false, children,
}: {
  week: MeterWeek;
  barMax: number;
  cap: number;
  level: number;
  lifetime: number;
  streak: number;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const shown = useCountUp(week.bar);
  const shownLife = useCountUp(lifetime);
  const [flare, setFlare] = useState(false);
  const last = useRef(week.bar);

  useEffect(() => {
    if (week.bar > last.current) {
      setFlare(true);
      const t = window.setTimeout(() => setFlare(false), 1300);
      last.current = week.bar;
      return () => window.clearTimeout(t);
    }
    last.current = week.bar;
  }, [week.bar]);

  const q = Math.min(100, (week.quest / barMax) * 100);
  const c = Math.min(100 - q, (week.curiosityCounted / barMax) * 100);

  return (
    <div className={`${styles.meter} ${compact ? styles.compact : ''}`}>
      <div className={styles.top}>
        <p className={styles.figure} aria-live="polite">
          <span className={`${styles.num} ${flare ? styles.numFlare : ''}`}>{shown}</span>
          <span className={styles.of}> / {barMax}</span>
        </p>
        <dl className={styles.facts}>
          <div><dt>Level</dt><dd>{level}</dd></div>
          <div><dt>Lifetime</dt><dd>{shownLife.toLocaleString('en-GB')}</dd></div>
          <div><dt>Full weeks in a row</dt><dd>{streak}</dd></div>
        </dl>
      </div>

      <div
        className={`${styles.track} ${flare ? styles.trackFlare : ''} ${week.full ? styles.trackFull : ''}`}
        role="progressbar"
        aria-label="Points this week"
        aria-valuemin={0}
        aria-valuemax={barMax}
        aria-valuenow={Math.min(week.bar, barMax)}
      >
        <span className={styles.fill} style={{ width: `${q}%` }} />
        <span className={`${styles.fill} ${styles.fillCur}`} style={{ left: `${q}%`, width: `${c}%` }} />
      </div>

      <p className={styles.legend}>
        <span>Quests {week.quest}</span>
        <span>Curiosity {week.curiosityCounted} of {cap}</span>
        {week.full && <span className={styles.full}>Full{week.extra > 0 ? ` · +${week.extra} extra` : ''}</span>}
      </p>
      {children}
    </div>
  );
}
