'use client';

import { useEffect, useState } from 'react';
import styles from './LoadingSplash.module.css';

/*
 * Loading splash — first-paint overlay shown once per session on the
 * homepage. Paired with LoadingSplashGate, an inline script that runs
 * during body parse and sets html[data-splash='showing'] before any
 * content paints.
 *
 * Hydration-safe rendering: the overlay markup is ALWAYS rendered on
 * both server and client (identical output → no hydration mismatch).
 * Visibility is driven entirely by CSS keyed on html[data-splash]:
 *   - data-splash absent  → .overlay { display: none }   (invisible)
 *   - data-splash present  → .overlay { display: flex }   (the splash)
 * So on a first '/' load the splash is visible from the very first
 * server-painted frame, before React even hydrates. The component's
 * only job after hydration is to drive the stage timeline and clear
 * the gate flag at the end.
 *
 * The earlier version derived an `active` boolean from data-splash in a
 * useState initializer — that produced different output on server (null)
 * vs client (the overlay), a hydration mismatch that could deopt the
 * root render in production. This version never does that.
 *
 * Timeline (2s, then a 500ms fade):
 *   logo → line → hold → exit → done
 *   0      600     1400   2000   2500ms
 */

type Stage = 'logo' | 'line' | 'hold' | 'exit' | 'done';

export function LoadingSplash() {
  const [stage, setStage] = useState<Stage>('logo');

  useEffect(() => {
    /* If the gate didn't mark this load (repeat visit, reduced motion,
       non-home route), tear the overlay out of the DOM immediately. It
       was already invisible via CSS, so nothing flashes. */
    if (document.documentElement.dataset.splash !== 'showing') {
      setStage('done');
      return;
    }

    const timers: number[] = [];
    timers.push(window.setTimeout(() => setStage('line'), 600));
    timers.push(window.setTimeout(() => setStage('hold'), 1400));
    timers.push(window.setTimeout(() => setStage('exit'), 2000));
    timers.push(
      window.setTimeout(() => {
        try {
          sessionStorage.setItem('hg-loaded', '1');
        } catch {
          /* sessionStorage can throw in private mode; harmless. */
        }
        /* Removing the attribute flips the CSS back to display:none and
           reveals the page underneath. The opacity fade (stage='exit')
           has already played over the preceding 500ms. */
        document.documentElement.removeAttribute('data-splash');
        setStage('done');
      }, 2500),
    );

    return () => timers.forEach(window.clearTimeout);
  }, []);

  /* Once finished, drop the markup entirely. */
  if (stage === 'done') return null;

  return (
    <div
      className={styles.overlay}
      data-stage={stage}
      data-splash-self=""
      aria-hidden="true"
    >
      <span className={styles.wordmark}>
        husayn gokal<span className={styles.dot}>.</span>
      </span>
      <span className={styles.rule} />
      <span className={styles.captionRow}>
        <span className={styles.pulse} />
        <span className={styles.caption}>polymathy in practice</span>
      </span>
    </div>
  );
}
