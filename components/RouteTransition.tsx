'use client';

import { usePathname } from 'next/navigation';
import styles from './RouteTransition.module.css';

/*
 * Route-transition wrapper. Wraps {children} in the root layout and
 * re-keys on every pathname change, so React remounts the subtree
 * and the fade-in CSS animation re-fires.
 *
 * Two variants:
 *   - default — 420ms ease-out fade-up. The site's usual register.
 *   - life    — 800ms breathier curve with a subtle scale + blur
 *               release. The Life Plan surface deliberately slows
 *               the reader (BRIEF Part XI), so its arrival animation
 *               does too. Page literally exhales into view.
 *
 * Trade-offs vs the browser-native View Transitions API:
 *   - Works in every browser (View Transitions is still Chromium-
 *     leaning on desktop and partial on iOS Safari).
 *   - No special navigation hook — works with every <Link>, every
 *     router.push(), every back/forward.
 *   - Fade-out is implicit (the old DOM disappears at swap time);
 *     only the new page fades in. The longer durations here make
 *     the disappearance read as a controlled hand-off rather than
 *     a hard cut.
 *
 * `prefers-reduced-motion` skips the animation entirely (page just
 * appears, no opacity ramp).
 */

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLife = pathname.startsWith('/life');
  return (
    <div
      key={pathname}
      className={isLife ? styles.fadeLife : styles.fade}
    >
      {children}
    </div>
  );
}
