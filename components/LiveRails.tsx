'use client';

/*
 * Live plates on the homepage (Part V). Three signal channels, each a
 * cream plate with the same four rows:
 *
 *   kicker ............ mark      "currently reading"   + line mark
 *   FIGURE  unit                  the one number that matters
 *   title                         what it is
 *   ------------------------
 *   footer left .. footer right   the supporting detail
 *
 * The figure is the anchor. Because all three anchors are the same kind
 * of object (a large serif figure) and every row has a fixed height, the
 * plates line up by construction, whatever the titles and values are.
 *
 * Client component: subscribes to Realtime on current_state through
 * useLiveState. When a row changes the plate re-renders and a small
 * orange dot flashes beside its kicker for ~2s (Part V, "the orange dot
 * as unified affordance").
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { BookMark } from './marks/BookMark';
import { CalendarMark } from './marks/CalendarMark';
import { ProjectMark } from './marks/ProjectMark';
import { useLiveState } from '@/lib/use-live-state';
import type { LiveState } from '@/lib/content/state';
import styles from './LiveRails.module.css';

const DAY_MS = 86_400_000;
/* Rendered height of the corner marks; matches .mark in the CSS module. */
const MARK_PX = 22;

export function LiveRails({ initialState }: { initialState: LiveState }) {
  const { state, flashedKey } = useLiveState(initialState);
  const { reading, building, studying } = state;

  return (
    <section className={styles.rails} aria-label="Currently">
      {reading && (
        <Plate
          href={`/library/${reading.slug}`}
          kicker="currently reading"
          mark={<BookMark size={MARK_PX} />}
          flashing={flashedKey === 'currently_reading'}
          title={reading.title}
          {...readingFigure(reading)}
          footLeft={reading.author}
          footRight={
            reading.progressPct != null && reading.progressPct > 0 ? (
              <span className={styles.track} aria-hidden="true">
                <span className={styles.fill} style={{ width: `${clampPct(reading.progressPct)}%` }} />
              </span>
            ) : null
          }
        />
      )}

      {building && (
        <Plate
          href={building.href ?? `/projects/${building.slug}`}
          kicker="currently building"
          mark={<ProjectMark size={MARK_PX} />}
          flashing={flashedKey === 'currently_building'}
          title={building.title}
          {...buildingFigure(building)}
          footLeft={building.kind === 'task' ? 'task' : 'branch'}
          footRight={
            building.kind === 'task' ? 'in progress' : <span className={styles.chip}>{building.branch}</span>
          }
        />
      )}

      {studying && (
        <Plate
          href={`/study/credentials/${studying.slug}`}
          kicker="currently studying"
          mark={<CalendarMark size={MARK_PX} />}
          flashing={flashedKey === 'currently_studying'}
          title={studying.title}
          {...studyingFigure(studying)}
        />
      )}
    </section>
  );
}

/* -- The plate ---------------------------------------------------------- */

interface Figure {
  figure: string;
  unit: string;
  /** Pulse the orange dot beside the unit: the signal is live right now. */
  live?: boolean;
  footLeft?: ReactNode;
  footRight?: ReactNode;
}

function Plate({
  href, kicker, mark, flashing, title, figure, unit, live, footLeft, footRight,
}: Figure & {
  href: string;
  kicker: string;
  mark: ReactNode;
  flashing: boolean;
  title: string;
}) {
  return (
    <Link href={href} className={styles.plate}>
      <span className={styles.top}>
        <span className={styles.kicker}>
          {kicker}
          {flashing && <span className={styles.flashIndicator} aria-hidden="true" />}
        </span>
        <span className={styles.mark}>{mark}</span>
      </span>
      {/* The figures depend on today's date, which can differ between the
          server render and the visitor's clock around midnight. */}
      <span className={styles.figureRow} suppressHydrationWarning>
        <span className={styles.figure} suppressHydrationWarning>{figure}</span>
        <span className={styles.unit} suppressHydrationWarning>
          {live && <span className={styles.livePulse} aria-hidden="true" />}
          {unit}
        </span>
      </span>
      <span className={styles.title} title={title}>{title}</span>
      <span className={styles.foot}>
        <span className={styles.footLeft} suppressHydrationWarning>{footLeft}</span>
        <span className={styles.footRight} suppressHydrationWarning>{footRight}</span>
      </span>
    </Link>
  );
}

/* -- Figures: one honest number per plate ------------------------------- */

function clampPct(pct: number): number {
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function readingFigure(r: NonNullable<LiveState['reading']>): Figure {
  /* "In progress, percentage unknown" is a real state (see state.ts). */
  if (r.progressPct == null || r.progressPct <= 0) return { figure: 'now', unit: 'in progress' };
  return { figure: `${clampPct(r.progressPct)}%`, unit: 'through' };
}

/* Real last-active date, never a hardcoded "active now". Day precision is
   all the source has (vault edit / last-active date), so the figure is a
   count of days, weeks or months; the dot only pulses when it is fresh.
   Thresholds mirror relativeDay() in lib/content/state.ts so this plate
   and the typewriter's "active 1 month ago" never disagree. */
function buildingFigure(b: NonNullable<LiveState['building']>): Figure {
  const then = new Date(b.lastActiveDate).getTime();
  const days = Number.isFinite(then) ? Math.floor((Date.now() - then) / DAY_MS) : 0;
  if (days <= 0) return { figure: 'today', unit: 'last active', live: true };
  const since = (n: number, noun: string, live = false): Figure => ({
    figure: String(n),
    unit: `${noun}${n === 1 ? '' : 's'} since active`,
    live,
  });
  if (days < 7) return since(days, 'day', days === 1);
  if (days < 30) return since(Math.floor(days / 7), 'week');
  return since(Math.floor(days / 30), 'month');
}

function studyingFigure(s: NonNullable<LiveState['studying']>): Figure {
  const exam = s.examDate ? new Date(s.examDate) : null;
  /* Rolling course with no fixed exam (the derive fallback). */
  if (!exam || Number.isNaN(exam.getTime())) {
    return { figure: 'now', unit: 'in progress', footLeft: 'course', footRight: 'no fixed exam' };
  }
  const examLabel = exam.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  }).replace(',', '');
  const foot = { footLeft: 'exam', footRight: examLabel };
  /* Days remaining, computed client-side so the count stays fresh across
     midnights without a re-poll or vault sync. */
  const daysUntil = Math.ceil((exam.getTime() - Date.now()) / DAY_MS);
  if (s.awaitingResults || daysUntil < 0) return { figure: 'sat', unit: 'awaiting results', ...foot };
  if (daysUntil === 0) return { figure: 'today', unit: 'exam day', live: true, ...foot };
  return { figure: String(daysUntil), unit: daysUntil === 1 ? 'day to exam' : 'days to exam', ...foot };
}
