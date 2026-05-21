'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Typewriter.module.css';

/*
 * Live-state typewriter (Part V).
 *
 * Cycles through phrases generated from current state. Per the brief:
 *   - 55–100ms per char, with slight randomization (organic feel)
 *   - 1.8s pause when phrase complete
 *   - 28ms per char for deletion
 *   - 320ms pause before next phrase begins
 *
 * Pulsing orange caret accompanies the typewriter and inherits the
 * site's unified motion vocabulary (orange = live).
 *
 * Under prefers-reduced-motion, the typewriter shows a single static
 * phrase instead of animating. Honored absolutely per Part III.
 *
 * New state arriving mid-phrase is queued and surfaces on the next cycle —
 * no mid-animation interruption (Part V). Implementation: the `phrases`
 * prop updates the queue on every render; the active phrase set only
 * swaps when the cycle returns to phrase index 0 in the 'gap' phase.
 */

type Phase = 'typing' | 'pausing' | 'deleting' | 'gap';

const TYPE_MIN = 55;
const TYPE_MAX = 100;
const PAUSE_MS = 1800;
const DEL_MS   = 28;
const GAP_MS   = 320;

export function Typewriter({
  phrases,
  reducedFallbackIndex = 0,
}: {
  phrases: string[];
  reducedFallbackIndex?: number;
}) {
  const fallback = phrases.length > 0 ? phrases : ['currently here, writing this.'];

  /* activePhrases is what we're cycling through right now. queuedPhrasesRef
     tracks the latest from props; we swap activePhrases to the queued set
     only when we're about to start a new phrase (phase=gap), satisfying
     the brief's no-interruption rule. */
  const [activePhrases, setActivePhrases] = useState<string[]>(fallback);
  const queuedPhrasesRef = useRef<string[]>(fallback);

  useEffect(() => {
    queuedPhrasesRef.current = phrases.length > 0 ? phrases : ['currently here, writing this.'];
  }, [phrases]);

  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<Phase>('typing');
  const [reduced, setReduced] = useState(false);
  const timerRef = useRef<number | null>(null);

  /* Honor prefers-reduced-motion */
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(m.matches);
    onChange();
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);

  /* The animation loop — one effect, one timer, direction-aware */
  useEffect(() => {
    if (reduced) return;
    const phrase = activePhrases[index % activePhrases.length];
    const clear = () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
    clear();

    if (phase === 'typing') {
      if (pos < phrase.length) {
        const delay = TYPE_MIN + Math.random() * (TYPE_MAX - TYPE_MIN);
        timerRef.current = window.setTimeout(() => setPos((p) => p + 1), delay);
      } else {
        timerRef.current = window.setTimeout(() => setPhase('pausing'), 0);
      }
    } else if (phase === 'pausing') {
      timerRef.current = window.setTimeout(() => setPhase('deleting'), PAUSE_MS);
    } else if (phase === 'deleting') {
      if (pos > 0) {
        timerRef.current = window.setTimeout(() => setPos((p) => p - 1), DEL_MS);
      } else {
        timerRef.current = window.setTimeout(() => setPhase('gap'), 0);
      }
    } else if (phase === 'gap') {
      timerRef.current = window.setTimeout(() => {
        /* Advance to the next phrase. If the queued set has a
           genuinely different SHAPE (count or starting words), swap
           to it and start from index 0. Identical-shape arrays are
           treated as "same rotation" even if their content drifts
           every second (the listening phrase carries elapsed time
           that updates per tick — without this check we'd reset to
           index 0 every cycle and never reach phrases past the
           first one). */
        const sameShape = phraseShapeMatches(queuedPhrasesRef.current, activePhrases);
        if (!sameShape) {
          setActivePhrases(queuedPhrasesRef.current);
          setIndex(0);
        } else {
          /* Use the latest content for the next render but keep the
             cursor moving forward. */
          if (queuedPhrasesRef.current !== activePhrases) {
            setActivePhrases(queuedPhrasesRef.current);
          }
          setIndex((i) => (i + 1) % activePhrases.length);
        }
        setPhase('typing');
      }, GAP_MS);
    }

    return clear;
  }, [phase, pos, index, reduced, activePhrases]);

  if (reduced) {
    /* For reduced-motion users we want the latest content too */
    const live = queuedPhrasesRef.current;
    const i = reducedFallbackIndex % live.length;
    return (
      <p className={styles.typewriter}>
        <span>{live[i]}</span>
      </p>
    );
  }

  const phrase = activePhrases[index % activePhrases.length];
  const visible = phrase.slice(0, pos);

  return (
    <p className={styles.typewriter} aria-live="polite" aria-atomic="true">
      <span>{visible}</span>
      <span className={styles.caret} aria-hidden="true" />
    </p>
  );
}

/* Two phrase arrays match in "shape" when they describe the same set
   of currently-X slots even if the content drifted between renders.
   We compare counts and the first three words of each phrase, which
   is the verb-plus-noun stem ("currently building slipwise…", "currently
   listening to onerepublic…"). The listening phrase's trailing elapsed
   time ("2:48 in.") changes every second, but its stem stays put, so
   this check stays true tick-to-tick and the cursor keeps advancing. */
function phraseShapeMatches(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const sa = a[i].split(/\s+/).slice(0, 3).join(' ');
    const sb = b[i].split(/\s+/).slice(0, 3).join(' ');
    if (sa !== sb) return false;
  }
  return true;
}
