'use client';

/*
 * Live plates on the homepage (Part V). Three signal channels, each a
 * cream plate with the same four rows:
 *
 *   kicker ............ mark      "currently reading"   + line mark
 *   FIGURE  unit                  the one number that matters
 *                                 (percent read, weeks into the project,
 *                                 days to the exam)
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
import { useState, type ReactNode } from 'react';
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
  const { reading, building: buildingSlot, studying: studyingSlot } = state;

  /* Building and studying can each hold several things at once; the plate
     shows one and the arrows step through the rest. */
  const builds = buildingSlot ? [buildingSlot, ...(buildingSlot.others ?? [])] : [];
  const studies = studyingSlot ? [studyingSlot, ...(studyingSlot.others ?? [])] : [];
  const [bi, setBi] = useState(0);
  const [si, setSi] = useState(0);
  const building = builds.length ? builds[bi % builds.length] : null;
  const studying = studies.length ? studies[si % studies.length] : null;
  const pager = (n: number, i: number, set: (f: (x: number) => number) => void, what: string) => n > 1 ? {
    label: `${(i % n) + 1} of ${n}`,
    what,
    prev: () => set((x) => (x - 1 + n) % n),
    next: () => set((x) => (x + 1) % n),
  } : undefined;

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
          pager={pager(builds.length, bi, setBi, 'project')}
          {...buildingFigure(building)}
        />
      )}

      {studying && (
        <Plate
          href={studying.href ?? `/study/credentials/${studying.slug}`}
          kicker="currently studying"
          mark={<CalendarMark size={MARK_PX} />}
          flashing={flashedKey === 'currently_studying'}
          title={studying.title}
          pager={pager(studies.length, si, setSi, 'thing being studied')}
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
  /** Pulse the orange dot beside the kicker: the signal is live right now. */
  live?: boolean;
  footLeft?: ReactNode;
  footRight?: ReactNode;
}

interface Pager { label: string; what: string; prev: () => void; next: () => void }

function Plate({
  href, kicker, mark, flashing, title, figure, unit, live, footLeft, footRight, pager,
}: Figure & {
  href: string;
  kicker: string;
  mark: ReactNode;
  flashing: boolean;
  title: string;
  pager?: Pager;
}) {
  const link = (
    <Link href={href} className={styles.plate}>
      <span className={styles.top}>
        {/* One dot, after the label. It pulses while the signal is live and
            flashes for ~2s when a Realtime update lands. It sits here, not
            beside the figure, because a dot at the figure's baseline reads
            as a full stop ("6."). */}
        <span className={styles.kicker}>
          {kicker}
          {(live || flashing) && (
            <span className={flashing ? styles.flashIndicator : styles.livePulse} aria-hidden="true" />
          )}
        </span>
        <span className={styles.mark}>{mark}</span>
      </span>
      {/* The figures depend on today's date, which can differ between the
          server render and the visitor's clock around midnight. */}
      <span className={styles.figureRow} suppressHydrationWarning>
        <span className={styles.figure} suppressHydrationWarning>{figure}</span>
        <span className={styles.unit} suppressHydrationWarning>{unit}</span>
      </span>
      <span className={styles.title} title={title}>{title}</span>
      <span className={styles.foot}>
        <span className={styles.footLeft} suppressHydrationWarning>{footLeft}</span>
        <span className={styles.footRight} suppressHydrationWarning>{footRight}</span>
      </span>
    </Link>
  );
  if (!pager) return link;
  /* The arrows sit over the plate's top row, outside the link (a button
     inside a link is not allowed), left of the corner mark. */
  return (
    <div className={styles.plateWrap}>
      {link}
      <span className={styles.pager}>
        <button type="button" className={styles.pagerBtn} onClick={pager.prev} aria-label={`Previous ${pager.what}`}>‹</button>
        <span className={styles.pagerCount} aria-live="polite">{pager.label}</span>
        <button type="button" className={styles.pagerBtn} onClick={pager.next} aria-label={`Next ${pager.what}`}>›</button>
      </span>
    </div>
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

/* A project is on this plate because its status is `active`: the author
   has it switched on as the thing being worked on right now. There is no
   "last active" date to keep fresh. The figure is how long the project has
   been running, which needs no upkeep at all, and the dot pulses because
   being on the plate already means it is live. */
function buildingFigure(b: NonNullable<LiveState['building']>): Figure {
  const start = b.started ? new Date(b.started) : null;
  if (!start || Number.isNaN(start.getTime())) {
    return { figure: 'now', unit: 'in progress', live: true, footLeft: 'status', footRight: 'active' };
  }
  const foot = {
    footLeft: 'started',
    footRight: start.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
  };
  const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / DAY_MS));
  const running = (n: number, noun: string): Figure => ({
    figure: String(n), unit: `${noun}${n === 1 ? '' : 's'} in`, live: true, ...foot,
  });
  if (days < 1) return { figure: 'today', unit: 'started', live: true, ...foot };
  if (days < 14) return running(days, 'day');
  if (days < 112) return running(Math.floor(days / 7), 'week');
  return running(Math.floor(days / 30), 'month');
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
