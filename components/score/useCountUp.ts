'use client';

import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '@/lib/score/fx';

/* A number that rolls from its last value to a new one, ease-out, like a
   score counter. Jumps straight there under prefers-reduced-motion. */
export function useCountUp(target: number, ms = 750): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = from.current;
    if (start === target || reducedMotion()) {
      from.current = target;
      setShown(target);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - (1 - p) ** 3;
      const v = Math.round(start + (target - start) * eased);
      setShown(v);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      from.current = target;
    };
  }, [target, ms]);

  return shown;
}
