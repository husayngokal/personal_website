'use client';

/*
 * The bar at the very top of every page, and the effects layer.
 *
 * A thin orange line pinned to the top edge of the viewport: this week's
 * points out of the bar, live. It loads its own number in the browser (so
 * every page carries it without making any page dynamic), listens for the
 * `score` row over Realtime, and listens for the in-page score event that
 * a Studio tap fires.
 *
 * On a tap the effects run from the button that was pressed: the points
 * float up, orange sparks burst out, the line flares and its number shows.
 * Crossing a quarter of the bar says so; filling it rains orange from the
 * top; a new level gets its own moment. Sounds and vibration come from
 * lib/score/fx.ts and only answer the viewer's own tap.
 *
 * Orange is the only colour that moves, and only orange moves here.
 * prefers-reduced-motion keeps the numbers and drops the motion.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import {
  SCORE_FX_EVENT, buzz, playFull, playGain, playLevelUp, playQuarter, quartersCrossed, reducedMotion,
  type ScoreFxDetail,
} from '@/lib/score/fx';
import styles from './TopScoreBar.module.css';

interface Lite { bar: number; max: number }
interface Spark { id: number; x: number; y: number; dx: number; dy: number; size: number; delay: number; rain?: boolean }
interface Float { id: number; x: number; y: number; text: string; combo?: number }

const QUARTER_WORDS = ['', 'A quarter.', 'Halfway.', 'Three quarters.', 'Full.'];
let nextId = 1;

export function TopScoreBar() {
  const [s, setS] = useState<Lite | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [flare, setFlare] = useState(false);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [banner, setBanner] = useState<{ id: number; text: string; big: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  const lastBar = useRef<number | null>(null);

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
    lastBar.current = bar;
    setS({ bar, max });
    if (prev !== null && bar > prev) showTag(`+${bar - prev} · ${bar} / ${max}`);
  }, [showTag]);

  /* A tap on this device: the full show. */
  const onFx = useCallback((d: ScoreFxDetail) => {
    lastBar.current = d.after.bar;
    setS({ bar: d.after.bar, max: d.barMax });
    if (d.gained <= 0) return;
    showTag(`+${d.gained} · ${d.after.bar} / ${d.barMax}`);

    const quarters = quartersCrossed(d.before.bar, d.after.bar, d.barMax);
    const levelUp = d.levelAfter > d.levelBefore;
    const top = quarters.length ? quarters[quarters.length - 1] : 0;

    if (d.sound) {
      playGain(d.gained, d.combo ?? 1);
      if (top === 4) playFull();
      else if (top) playQuarter(top);
      if (levelUp) playLevelUp();
      buzz(top === 4 || levelUp ? [30, 40, 30, 40, 90] : top ? [20, 30, 20] : 14);
    }

    const calm = reducedMotion();
    const o = d.origin ?? { x: window.innerWidth - 80, y: 24 };
    const fid = nextId++;
    setFloats((f) => [...f, { id: fid, x: o.x, y: o.y, text: `+${d.gained}`, combo: d.combo && d.combo > 1 ? d.combo : undefined }]);
    later(() => setFloats((f) => f.filter((x) => x.id !== fid)), 1300);

    if (!calm) {
      const n = Math.max(10, Math.min(36, 8 + Math.round(d.gained / 2)));
      const burst: Spark[] = Array.from({ length: n }, () => {
        const a = Math.random() * Math.PI * 2;
        const r = 40 + Math.random() * (60 + d.gained * 1.5);
        return { id: nextId++, x: o.x, y: o.y, dx: Math.cos(a) * r, dy: Math.sin(a) * r - 30, size: 4 + Math.random() * 5, delay: Math.random() * 60 };
      });
      if (top === 4 || levelUp) {
        for (let i = 0; i < 90; i++) {
          burst.push({
            id: nextId++, x: Math.random() * window.innerWidth, y: -10,
            dx: (Math.random() - 0.5) * 120, dy: window.innerHeight * (0.6 + Math.random() * 0.5),
            size: 5 + Math.random() * 6, delay: Math.random() * 700, rain: true,
          });
        }
      }
      const ids = new Set(burst.map((b) => b.id));
      setSparks((sp) => [...sp, ...burst]);
      later(() => setSparks((sp) => sp.filter((x) => !ids.has(x.id))), top === 4 || levelUp ? 2600 : 1200);
    }

    const text = levelUp ? `Level ${d.levelAfter}.` : top ? QUARTER_WORDS[top] : null;
    if (text) {
      const bid = nextId++;
      setBanner({ id: bid, text, big: top === 4 || levelUp });
      later(() => setBanner((b) => (b?.id === bid ? null : b)), top === 4 || levelUp ? 2600 : 1600);
    }
  }, [later, showTag]);

  useEffect(() => {
    const handler = (e: Event) => onFx((e as CustomEvent<ScoreFxDetail>).detail);
    window.addEventListener(SCORE_FX_EVENT, handler);
    let channel: ReturnType<ReturnType<typeof getBrowserClient>['channel']> | null = null;
    if (isSupabaseConfigured()) {
      const supabase = getBrowserClient();
      void supabase
        .from('current_state')
        .select('week:value->week, bar:value->bar')
        .eq('key', 'score')
        .maybeSingle()
        .then(({ data }) => {
          const d = data as { week?: { bar?: number }; bar?: number } | null;
          if (d?.week && typeof d.week.bar === 'number' && lastBar.current === null) {
            lastBar.current = d.week.bar;
            setS({ bar: d.week.bar, max: d.bar ?? 200 });
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
      window.removeEventListener(SCORE_FX_EVENT, handler);
      if (channel && isSupabaseConfigured()) void getBrowserClient().removeChannel(channel);
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, [onFx, applyBar]);

  if (!s) return null;
  const pct = Math.min(100, (s.bar / s.max) * 100);
  const full = s.bar >= s.max;

  return (
    <>
      <Link href="/#this-week" className={styles.hit} aria-label={`This week: ${s.bar} of ${s.max} points`}>
        <span className={`${styles.line} ${flare ? styles.flare : ''} ${full ? styles.full : ''}`}>
          <span className={styles.fill} style={{ width: `${pct}%` }} />
        </span>
        <span className={`${styles.tag} ${tag ? styles.tagOn : ''}`}>{tag ?? `${s.bar} / ${s.max}`}</span>
      </Link>

      <div className={styles.fx} aria-hidden="true">
        {sparks.map((p) => (
          <span
            key={p.id}
            className={`${styles.spark} ${p.rain ? styles.rain : ''}`}
            style={{
              left: p.x, top: p.y, width: p.size, height: p.size,
              ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`,
              animationDelay: `${p.delay}ms`,
            }}
          />
        ))}
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
