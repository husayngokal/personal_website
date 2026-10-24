import Link from 'next/link';
import { ProgressBar } from './Primitives';
import styles from './SurfaceProgress.module.css';

/*
 * One surface's progress, in the page header: an orange bar with its
 * percentage, the count behind it, and what this surface added to the
 * week's score. Server component; the numbers come from the stored score
 * (lib/score), which the sync and every Studio tap refresh.
 */

export function SurfaceProgress({
  label, done, total, unit, weekPoints, note,
}: {
  label: string;
  done?: number;
  total?: number;
  unit?: string;
  weekPoints?: number;
  note?: string;
}) {
  const hasBar = typeof done === 'number' && typeof total === 'number' && total > 0;
  const pct = hasBar ? Math.round((done! / total!) * 100) : 0;
  return (
    <div className={styles.wrap}>
      <p className={styles.label}>{label}</p>
      {hasBar && <ProgressBar pct={pct} animate />}
      <p className={styles.count}>
        {hasBar && (
          <>
            <span className={styles.num}>{done}</span> of {total} {unit}
          </>
        )}
        {typeof weekPoints === 'number' && (
          <>
            {hasBar && <span className={styles.sep}>·</span>}
            <span className={styles.num}>{weekPoints}</span> {weekPoints === 1 ? 'point' : 'points'} this week
          </>
        )}
        {note && (
          <>
            <span className={styles.sep}>·</span>
            {note}
          </>
        )}
        <span className={styles.sep}>·</span>
        <Link href="/life/scoring" className={styles.link}>how scoring works</Link>
      </p>
    </div>
  );
}
