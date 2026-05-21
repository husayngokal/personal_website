'use client';

/*
 * Live rails on the homepage (Part V). Three signal channels:
 *   - currently reading (book spine + title + author + progress)
 *   - currently building (project + branch chip + pulsing dot + last commit)
 *   - currently studying (calendar tile + countdown to exam)
 *
 * Now a client component that subscribes to Realtime on the
 * current_state table via useLiveState. When a row changes:
 *   1. Local state updates and the rail re-renders
 *   2. The corresponding orange dot flashes brighter for ~2s
 *      (per Part V — "the orange dot as unified affordance")
 */

import Link from 'next/link';
import { BookCover } from './BookCover';
import { CalendarTile } from './marks/CalendarTile';
import { ProgressBar } from './Primitives';
import { useLiveState } from '@/lib/use-live-state';
import type { LiveState } from '@/lib/content/state';
import styles from './LiveRails.module.css';

export function LiveRails({ initialState }: { initialState: LiveState }) {
  const { state, flashedKey } = useLiveState(initialState);

  const flashing = (k: string) => flashedKey === k;

  return (
    <section className={styles.rails} aria-label="Currently">
      {state.reading && (
        <Link href={`/library/${state.reading.slug}`} className={styles.rail}>
          <BookCover url={state.reading.coverUrl} width={40} height={56} alt={`${state.reading.title} cover`} />
          <div className={styles.railBody}>
            <p className={styles.railLabel}>
              currently reading
              <FlashDot active={flashing('currently_reading')} />
            </p>
            <p className={styles.railTitle}>{state.reading.title}</p>
            <p className={styles.railMeta}>
              <span className={styles.railSub}>{state.reading.author}</span>
              <span className={styles.railDot}>·</span>
              <ProgressBar pct={state.reading.progressPct ?? 0} showLabel width="100px" />
            </p>
          </div>
        </Link>
      )}

      {state.building && (
        <Link href={`/projects/${state.building.slug}`} className={styles.rail}>
          <div className={styles.railBody}>
            <p className={styles.railLabel}>
              currently building
              <FlashDot active={flashing('currently_building')} />
            </p>
            <p className={styles.railTitle}>{state.building.title}</p>
            <p className={styles.railMeta}>
              <span className={styles.branchChip}>{state.building.branch}</span>
              <span className={`${styles.livePulse} ${flashing('currently_building') ? styles.livePulseFlash : ''}`} aria-hidden="true" />
              <span className={styles.railCommitTime}>
                active {relativeDayShort(state.building.lastActiveDate)}
              </span>
            </p>
          </div>
        </Link>
      )}

      {state.studying && <StudyingRail data={state.studying} flashing={flashing('currently_studying')} />}
    </section>
  );
}

function StudyingRail({
  data, flashing,
}: {
  data: NonNullable<LiveState['studying']>;
  flashing: boolean;
}) {
  const exam = new Date(data.examDate);
  const monthCode = exam.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const day = exam.getUTCDate();
  const weekday = exam.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' });

  /* Compute days remaining client-side so the count stays fresh across
     midnights without needing a re-poll or vault sync. */
  const daysUntil = Math.ceil((exam.getTime() - Date.now()) / 86_400_000);

  return (
    <Link href={`/study/credentials/${data.slug}`} className={styles.rail}>
      <CalendarTile monthCode={monthCode} day={day} weekday={weekday} />
      <div className={styles.railBody}>
        <p className={styles.railLabel}>
          currently studying
          <FlashDot active={flashing} />
        </p>
        <p className={styles.railTitle}>{data.title}</p>
        <p className={styles.railMeta}>
          Exam in <span className={styles.daysOrange}>{daysUntil} {daysUntil === 1 ? 'day' : 'days'}</span>
        </p>
      </div>
    </Link>
  );
}

function FlashDot({ active }: { active: boolean }) {
  if (!active) return null;
  return <span className={styles.flashIndicator} aria-hidden="true" />;
}

function relativeDayShort(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7)   return `${days}d ago`;
  if (days < 30)  return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
