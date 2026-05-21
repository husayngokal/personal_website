'use client';

import { useEffect, useState } from 'react';
import { GRID_WEEKS, WEEKS_PER_YEAR, lifeCounters, type LifeCounters } from '@/lib/memento';
import styles from './LifeGrid.module.css';

/*
 * Life-in-weeks grid. 70 rows × 52 cells (3,640 squares; the
 * GRID_YEARS / WEEKS_PER_YEAR constants drive the dimensions so a
 * future convention change propagates from one place). Cells past
 * the current week are empty (border-only); cells up to the current
 * week are filled in ink; the current cell pulses in orange.
 *
 * Client component so the orange pulse stays a live element rather
 * than a build-time snapshot. Re-renders once per minute (cheap;
 * grid mutates only at week boundaries).
 */

export function LifeGrid({ initial }: { initial: LifeCounters }) {
  const [current, setCurrent] = useState(initial.weekOfLife);

  useEffect(() => {
    const tick = () => setCurrent(lifeCounters().weekOfLife);
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const cells: { lived: boolean; isCurrent: boolean }[] = [];
  for (let i = 1; i <= GRID_WEEKS; i++) {
    cells.push({ lived: i < current, isCurrent: i === current });
  }

  return (
    <div className={styles.gridWrap} role="img" aria-label={`Week ${current} of life`}>
      {Array.from({ length: GRID_WEEKS / WEEKS_PER_YEAR }, (_, rowIdx) => (
        <div key={rowIdx} className={styles.row}>
          {cells.slice(rowIdx * WEEKS_PER_YEAR, (rowIdx + 1) * WEEKS_PER_YEAR).map((cell, colIdx) => (
            <span
              key={colIdx}
              className={`${styles.cell} ${cell.lived ? styles.cellLived : ''} ${cell.isCurrent ? styles.cellCurrent : ''}`}
              aria-hidden="true"
            />
          ))}
          {/* Decade label every 10 years */}
          {(rowIdx + 1) % 10 === 0 && (
            <span className={styles.decadeLabel}>{rowIdx + 1}</span>
          )}
        </div>
      ))}
    </div>
  );
}
