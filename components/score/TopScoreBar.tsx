'use client';

/*
 * The bar at the very top of every page, and the effects layer.
 *
 * A thin orange line pinned to the top edge of the viewport: this week's
 * points out of the bar, live. It loads its own number in the browser (so
 * every page carries it without making any page dynamic), listens for the
 * `score` row over Realtime, and listens for the in-page score event that
 * a Studio tap fires the instant the button is pressed.
 *
 * A tap plays out in order: a shockwave and sparks at the finger, the
 * points rising as text, then the points themselves flying up into the
 * line as comets. The line fills, flares and chimes when they land, not
 * before. A quarter of the bar says so; a full bar rains orange from the
 * top; a new level gets its own moment. Drawing happens on one canvas
 * (lib/score/particles.ts) that sleeps when nothing moves.
 *
 * Orange is the only colour that moves, and only orange moves here.
 * prefers-reduced-motion keeps the numbers and the sound, drops the motion.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import {
  SCORE_FX_EVENT, buzz, playFull, playGain, playLand, playLevelUp, playQuarter, quartersCrossed, reducedMotion,
  type ScoreFxDetail,
} from '@/lib/score/fx';
import { FxCanvas } from '@/lib/score/particles';
import { authorDay, weekStart } from '@/lib/content/streak';
import styles from './TopScoreBar.module.css';

interface Lite { bar: number; max: number }
interface Float { id: number; x: number; y: number; text: string; combo?: number }

const QUARTER_WORDS = ['', 'A quarter.', 'Halfway.', 'Three quarters.', 'Full.'];
let nextId = 1;

export function TopScoreBar() {
  const [s, setS] = useState<Lite | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [flare, setFlare] = useState(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const [banner, setBanner] = useState<{ id: number; text: string; big: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  const lastBar = useRef<number | null>(null);
  /* After a tap here, an older recompute arriving late must not pull the
     line back; hold the shown value up for a minute, or until released
     (an undo or failed save, where lower is right). */
  const holdUntil = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fx = useRef<FxCanvas | null>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const showTag = useCallback((text: string) => {
    setTag(text);
    setFlare(true);
    later(() => setFlare(false), 1400);
    later(() => setTag((t) => (t === text ? null : t)), 2800);
  }, [later]);

  /* A plain change (Realtime, another device): move the line, show it. */
  const applyBar = useCallback((bar: number, max: number) => {
    const prev = lastBar.current;
    if (prev === bar) return;
    if (prev !== null && bar < prev && Date.now() < holdUntil.current) return;
    lastBar.current = bar;
    setS({ bar, max });
    if (prev !== null && bar > prev) showTag(`+${bar - prev} · ${bar} / ${max}`);
  }, [showTag]);

  /* A tap on this device: the full show. */
  const onFx = useCallback((d: ScoreFxDetail) => {
    lastBar.current = d.after.bar;
    if (d.gained <= 0) { holdUntil.current = 0; setS({ bar: d.after.bar, max: d.barMax }); return; }
    holdUntil.current = Date.now() + 60_000;

    const quarters = quartersCrossed(d.before.bar, d.after.bar, d.barMax);
    const levelUp = d.levelAfter > d.levelBefore;
    const top = quarters.length ? quarters[quarters.length - 1] : 0;
    const big = top === 4 || levelUp;
    const calm = reducedMotion();
    const f0 = fx.current;
    /* Everything below is placed in the effects layer's own pixels, which
       the site zoom makes different from the pointer's. */
    const o = d.origin && f0 ? f0.toLocal(d.origin.x, d.origin.y)
      : { x: (f0?.w || window.innerWidth) / 2, y: (f0?.h || window.innerHeight) / 2 };
    const width = f0?.w || window.innerWidth;

    if (d.sound) {
      playGain(d.gained, d.combo ?? 1);
      buzz(big ? [30, 40, 30, 40, 90] : top ? [20, 30, 20] : 14);
    }

    const fid = nextId++;
    setFloats((f) => [...f, { id: fid, x: o.x, y: o.y, text: `+${d.gained}`, combo: d.combo && d.combo > 1 ? d.combo : undefined }]);
    later(() => setFloats((f) => f.filter((x) => x.id !== fid)), 1300);

    /* What happens when the points reach the bar. */
    const arrive = () => {
      setS({ bar: d.after.bar, max: d.barMax });
      showTag(`+${d.gained} · ${d.after.bar} / ${d.barMax}`);
      if (d.sound) {
        playLand(d.gained);
        if (top === 4) playFull();
        else if (top) playQuarter(top);
        if (levelUp) playLevelUp();
      }
      if (!calm && fx.current) {
        const endX = Math.min(1, d.after.bar / d.barMax) * width;
        fx.current.burst(Math.max(12, endX - 6), 4, big ? 40 : 14, 0.55);
        if (big) fx.current.rain(levelUp ? 160 : 120);
      }
      const text = levelUp ? `Level ${d.levelAfter}.` : top ? QUARTER_WORDS[top] : null;
      if (text) {
        const bid = nextId++;
        setBanner({ id: bid, text, big });
        later(() => setBanner((b) => (b?.id === bid ? null : b)), big ? 2600 : 1600);
      }
    };

    if (calm || !fx.current) { arrive(); return; }
    const f = fx.current;
    f.ring(o.x, o.y, d.gained >= 20 ? 1.4 : 1);
    f.burst(o.x, o.y, Math.max(12, Math.min(44, 10 + Math.round(d.gained / 1.5))), d.gained >= 20 ? 1.2 : 1);
    const endX = Math.min(1, d.after.bar / d.barMax) * width;
    const n = Math.max(1, Math.min(7, Math.round(d.gained / 5)));
    f.comets(o.x, o.y, Math.max(16, endX - 8), 4, n, arrive);
  }, [later, showTag]);

  useEffect(() => {
    if (canvasRef.current && !fx.current) fx.current = new FxCanvas(canvasRef.current);
    const onResize = () => fx.current?.resize();
    window.addEventListener('resize', onResize);
    const handler = (e: Event) => onFx((e as CustomEvent<ScoreFxDetail>).detail);
    window.addEventListener(SCORE_FX_EVENT, handler);
    const release = () => { holdUntil.current = 0; };
    window.addEventListener('score:release', release);
    let channel: ReturnType<ReturnType<typeof getBrowserClient>['channel']> | null = null;
    if (isSupabaseConfigured()) {
      const supabase = getBrowserClient();
      void supabase
        .from('current_state')
        .select('week:value->week, bar:value->bar')
        .eq('key', 'score')
        .maybeSingle()
        .then(({ data }) => {
          const d = data as { week?: { bar?: number; start?: string }; bar?: number } | null;
          if (d?.week && typeof d.week.bar === 'number' && lastBar.current === null) {
            /* A week stored before this Monday has rolled over: show 0. */
            const bar = d.week.start && d.week.start < weekStart(authorDay()) ? 0 : d.week.bar;
            lastBar.current = bar;
            setS({ bar, max: d.bar ?? 200 });
          }
        });
      channel = supabase
        .channel(`topbar_${Math.random().toString(36).slice(2, 10)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'current_state', filter: 'key=eq.score' },
          (payload) => {
            const v = (payload.new as { value?: { version?: number; week?: { bar: number }; bar?: number } } | null)?.value;
            if (v?.version === 1 && v.week) applyBar(v.week.bar, v.bar ?? 200);
          },
        )
        .subscribe();
    }
    const pending = timers.current;
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener(SCORE_FX_EVENT, handler);
      window.removeEventListener('score:release', release);
      if (channel && isSupabaseConfigured()) void getBrowserClient().removeChannel(channel);
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, [onFx, applyBar]);

  useEffect(() => () => { fx.current?.destroy(); fx.current = null; }, []);

  const pct = s ? Math.min(100, (s.bar / s.max) * 100) : 0;
  const full = !!s && s.bar >= s.max;

  return (
    <>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {s && (
        <Link href="/#this-week" className={styles.hit} aria-label={`This week: ${s.bar} of ${s.max} points`}>
          <span className={`${styles.line} ${flare ? styles.flare : ''} ${full ? styles.full : ''}`}>
            <span className={styles.fill} style={{ width: `${pct}%` }} />
          </span>
          <span className={`${styles.tag} ${tag ? styles.tagOn : ''}`}>{tag ?? `${s.bar} / ${s.max}`}</span>
        </Link>
      )}

      <div className={styles.fx} aria-hidden="true">
        {floats.map((f) => (
          <span key={f.id} className={styles.float} style={{ left: f.x, top: f.y }}>
            {f.text}{f.combo ? <span className={styles.combo}> x{f.combo}</span> : null}
          </span>
        ))}
      </div>

      {banner && (
        <div className={styles.bannerWrap} role="status" aria-live="polite">
          <p key={banner.id} className={`${styles.banner} ${banner.big ? styles.bannerBig : ''}`}>{banner.text}</p>
        </div>
      )}
    </>
  );
}
