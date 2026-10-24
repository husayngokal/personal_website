'use client';

/*
 * The weekly bar: the one number.
 *
 * 200 points a week. Quest points fill it solid; curiosity fills it
 * hatched, up to its cap. Full means the week is done and nothing more is
 * owed; past full is shown as extra, a choice. Under it, what is on the
 * plate right now and the last twelve weeks.
 *
 * Server-rendered from the stored score, then live: it listens for the
 * `score` row in current_state, so a Studio tap moves the bar on every
 * open page within a second. The fill is orange and it moves; nothing
 * else here does. prefers-reduced-motion drops the motion, never the
 * information.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import type { ScoreState } from '@/lib/score/compute';
import { pts, shortDay, weekRange } from '@/lib/score/format';
import styles from './ScoreBoard.module.css';

const GAIN_MS = 2600;

/** Monday of the epoch's week (the epoch is itself a Monday). */
function epochWeek(epoch: string): string {
  const d = new Date(`${epoch}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function ScoreBoard({ initial }: { initial: ScoreState | null }) {
  const [state, setState] = useState(initial);
  const [gain, setGain] = useState<number | null>(null);
  const prevBar = useRef(initial?.week.bar ?? 0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`score_${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'current_state', filter: 'key=eq.score' },
        (payload) => {
          const next = (payload.new as { value?: ScoreState } | null)?.value;
          if (!next || next.version !== 1) return;
          const delta = next.week.bar - prevBar.current;
          prevBar.current = next.week.bar;
          setState(next);
          if (delta > 0) {
            setGain(delta);
            if (timer.current) window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setGain(null), GAIN_MS);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  if (!state) return null;
  const { week, bar, curiosityCap, lifetime, streak, history } = state;
  const questPct = Math.min(100, (week.quest / bar) * 100);
  const curPct = Math.min(100 - questPct, (week.curiosityCounted / bar) * 100);
  const plate = state.items.filter((i) => (i.active && i.parts.length > 0) || i.weekPoints > 0);
  /* Only weeks since scoring began: empty weeks before it are not misses. */
  const shown = history.filter((w) => w.start >= epochWeek(state.epoch));

  return (
    <div className={styles.board}>
      <div className={styles.top}>
        <div className={styles.figureBlock}>
          <p className={styles.range}>Week of {weekRange(week.start)}</p>
          <p className={styles.figure} aria-live="polite">
            <span className={styles.figureNum}>{week.bar}</span>
            <span className={styles.figureOf}> / {bar}</span>
            {gain !== null && <span className={styles.gain}>+{gain}</span>}
          </p>
        </div>
        <dl className={styles.facts}>
          <div><dt>Level</dt><dd>{lifetime.level}</dd></div>
          <div><dt>Lifetime</dt><dd>{lifetime.points.toLocaleString('en-GB')}</dd></div>
          <div><dt>Full weeks in a row</dt><dd>{streak}</dd></div>
        </dl>
      </div>

      <div
        className={`${styles.track} ${week.full ? styles.trackFull : ''}`}
        role="progressbar"
        aria-label="Points this week"
        aria-valuemin={0}
        aria-valuemax={bar}
        aria-valuenow={Math.min(week.bar, bar)}
      >
        <span className={styles.quest} style={{ width: `${questPct}%` }} />
        <span className={styles.curiosity} style={{ width: `${curPct}%`, left: `${questPct}%` }} />
      </div>

      <p className={styles.legend}>
        <span className={styles.key}><span className={`${styles.swatch} ${styles.swatchQuest}`} />Quests {week.quest}</span>
        <span className={styles.key}><span className={`${styles.swatch} ${styles.swatchCuriosity}`} />Curiosity {week.curiosityCounted} of {curiosityCap}</span>
        {week.curiosity > week.curiosityCounted && (
          <span className={styles.note}>{week.curiosity - week.curiosityCounted} past the cap, counted for lifetime only</span>
        )}
        <Link href="/life/scoring" className={styles.rules}>how scoring works</Link>
      </p>

      {week.full && (
        <p className={styles.full}>
          Full. Nothing more is owed this week.
          {week.extra > 0 && <span className={styles.extra}> +{week.extra} extra, by choice.</span>}
        </p>
      )}

      {plate.length > 0 && (
        <div className={styles.plate}>
          <p className={styles.plateHead}>On the plate</p>
          <ul className={styles.plateList}>
            {plate.map((i) => {
              const inner = (
                <>
                  <span className={styles.itemTitle}>{i.title}</span>
                  <span className={styles.itemBar} aria-hidden="true">
                    <span className={styles.itemFill} style={{ width: `${i.pct}%` }} />
                  </span>
                  <span className={styles.itemMeta}>
                    {[
                      i.summary,
                      i.deadline ? `due ${shortDay(i.deadline)}` : null,
                      i.lane === 'curiosity' ? 'curiosity' : null,
                    ].filter(Boolean).join(' · ')}
                  </span>
                  <span className={styles.itemWeek}>{i.weekPoints > 0 ? `+${i.weekPoints}` : ''}</span>
                </>
              );
              return (
                <li key={i.key}>
                  {i.href ? <Link href={i.href} className={styles.item}>{inner}</Link> : <span className={styles.item}>{inner}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className={styles.history}>
        <ol className={styles.weeks} aria-label="Weeks so far, oldest first">
          {shown.map((w, i) => {
            const h = Math.max(4, Math.min(100, (w.bar / bar) * 100));
            const now = i === shown.length - 1;
            return (
              <li
                key={w.start}
                className={`${styles.wk} ${now ? styles.wkNow : ''}`}
                title={`${weekRange(w.start)}: ${pts(w.bar)}${w.full ? ', full' : ''}`}
                aria-label={`${weekRange(w.start)}: ${pts(w.bar)}${w.full ? ', full' : ''}`}
              >
                <span className={`${styles.wkFill} ${w.full ? styles.wkFull : ''}`} style={{ height: `${w.bar ? h : 0}%` }} />
              </li>
            );
          })}
        </ol>
        <p className={styles.historyNote}>{shown.length === 1 ? 'The first week.' : `The last ${shown.length} weeks.`} Scoring began {shortDay(state.epoch)} {state.epoch.slice(0, 4)}.</p>
      </div>
    </div>
  );
}
