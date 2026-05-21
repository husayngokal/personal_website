'use client';

/*
 * useLiveState — client hook for subscribing to current_state Realtime.
 *
 * Receives the server-rendered initialState as a starting point, then
 * subscribes to Postgres changes on public.current_state. When a row
 * updates (Spotify poller, vault webhook, GitHub commit, etc.) the hook
 * re-derives the LiveState and consumers re-render.
 *
 * Also exposes `flashedKey` — the key that just changed — so visual
 * components can flash the corresponding orange dot for ~2s per Part V's
 * "orange dot as unified affordance" specification.
 */

import { useEffect, useRef, useState } from 'react';
import { getBrowserClient, isSupabaseConfigured } from './supabase';
import { phrasesFor, type LiveState } from './content/state';

const FLASH_MS = 2000;

export interface UseLiveStateResult {
  state: LiveState;
  phrases: string[];
  flashedKey: string | null;
}

export function useLiveState(initial: LiveState): UseLiveStateResult {
  const [state, setState] = useState<LiveState>(initial);
  const [flashedKey, setFlashedKey] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const flashTimer = useRef<number | null>(null);

  /* Tick once per second so the listening phrase re-renders with the
     latest client-computed elapsed time. Cheap (a number setState every
     second); the Typewriter still respects the no-mid-phrase-interrupt
     rule, so consumers see updated time on the next phrase boundary. */
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getBrowserClient();
    /* Per-mount unique channel name so React StrictMode's double-mount
       and any remount don't collide with an already-subscribed channel
       of the same name (Supabase JS reuses channel objects by name). */
    const channelName = `current_state_${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'current_state' },
        (payload) => {
          const row = (payload.new ?? payload.old) as { key: string; value: unknown };
          if (!row?.key) return;
          setState((prev) => mergeRow(prev, row.key, row.value));
          setFlashedKey(row.key);
          if (flashTimer.current) window.clearTimeout(flashTimer.current);
          flashTimer.current = window.setTimeout(() => setFlashedKey(null), FLASH_MS);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, []);

  return { state, phrases: phrasesFor(state, nowMs), flashedKey };
}

function mergeRow(prev: LiveState, key: string, value: unknown): LiveState {
  const empty = !value || (typeof value === 'object' && Object.keys(value as object).length === 0);
  const v = empty ? null : value;
  switch (key) {
    case 'currently_reading':   return { ...prev, reading:   v as LiveState['reading'] };
    case 'currently_building':  return { ...prev, building:  v as LiveState['building'] };
    case 'currently_studying':  return { ...prev, studying:  v as LiveState['studying'] };
    case 'currently_exploring': return { ...prev, exploring: v as LiveState['exploring'] };
    case 'currently_writing':   return { ...prev, writing:   v as LiveState['writing'] };
    case 'currently_listening': return { ...prev, listening: v as LiveState['listening'] };
    default: return prev;
  }
}
