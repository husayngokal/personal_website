'use client';

/*
 * Client wrapper around Typewriter that consumes the live current_state
 * subscription. Server-rendered initial state seeds the first paint;
 * Realtime pushes from Postgres update the phrase set thereafter.
 *
 * The Typewriter component itself respects the no-interruption rule:
 * queued phrase changes surface only at phrase boundaries.
 */

import { Typewriter } from './Typewriter';
import { useLiveState } from '@/lib/use-live-state';
import type { LiveState } from '@/lib/content/state';

export function LiveTypewriter({ initialState }: { initialState: LiveState }) {
  const { phrases } = useLiveState(initialState);
  return <Typewriter phrases={phrases} />;
}
