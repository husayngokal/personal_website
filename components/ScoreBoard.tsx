'use client';

/*
 * The homepage's "This week": the meter and nothing else.
 *
 * Server-rendered from the stored score, then live. It listens for the
 * `score` row in current_state (so a tap anywhere moves it within a
 * second) and for the in-page score event (so a tap on this device moves
 * it at once).
 */

import { useEffect, useState } from 'react';
import { getBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import type { ScoreState } from '@/lib/score/compute';
import { SCORE_FX_EVENT, type ScoreFxDetail } from '@/lib/score/fx';
import { ScoreMeter } from './score/ScoreMeter';
import { freshWeek } from '@/lib/score/format';

export function ScoreBoard({ initial }: { initial: ScoreState | null }) {
  const [state, setState] = useState(initial);

  useEffect(() => {
    const onFx = (e: Event) => {
      const d = (e as CustomEvent<ScoreFxDetail>).detail;
      setState((s) => (s ? { ...s, week: { ...s.week, ...d.after, extra: Math.max(0, d.after.bar - s.bar) } } : s));
    };
    window.addEventListener(SCORE_FX_EVENT, onFx);
    if (!isSupabaseConfigured()) return () => window.removeEventListener(SCORE_FX_EVENT, onFx);
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`score_${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'current_state', filter: 'key=eq.score' },
        (payload) => {
          const next = (payload.new as { value?: ScoreState } | null)?.value;
          if (next && next.version === 1) setState(next);
        },
      )
      .subscribe();
    return () => {
      window.removeEventListener(SCORE_FX_EVENT, onFx);
      void supabase.removeChannel(channel);
    };
  }, []);

  if (!state) return null;
  return (
    <ScoreMeter
      week={freshWeek(state.week)}
      barMax={state.bar}
      cap={state.curiosityCap}
      level={state.lifetime.level}
      lifetime={state.lifetime.points}
      streak={state.streak}
    />
  );
}
