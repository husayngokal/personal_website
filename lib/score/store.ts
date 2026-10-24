/*
 * Where the score lives between recomputes: one current_state row.
 *
 * current_state is key/value, so this needs no migration (the Supabase
 * dashboard is locked out). The vault stays the source of truth: the row
 * is a cache, rebuilt from every file on each sync and after each Studio
 * tap, and it can always be thrown away and recomputed.
 *
 * No 'server-only' import: the sync also runs from plain tsx scripts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isoUtc } from '../vault/tarball';
import { computeScore, type ScoreState } from './compute';
import { extractAll } from './items';
import type { VaultFile } from '../vault/tarball';

export const SCORE_KEY = 'score';

export async function readScore(db: SupabaseClient): Promise<ScoreState | null> {
  const { data } = await db.from('current_state').select('value').eq('key', SCORE_KEY).maybeSingle();
  const v = data?.value as ScoreState | undefined;
  return v && v.version === 1 ? v : null;
}

/** Recompute from a full set of vault files and store it.
 *
 *  `asOf` is the commit time the files were read at. Recomputes run in
 *  the background and can finish out of order (two quick taps, then the
 *  webhook sync), so the stored score carries its `asOf` and an older
 *  result never replaces a newer one: the bar can only show the latest
 *  commit's numbers, never step back to an earlier commit's.
 *
 *  `override` replaces one file's content (the file a tap just committed). */
export async function recomputeScore(
  db: SupabaseClient, files: VaultFile[], opts: { override?: VaultFile; asOf?: string } = {},
): Promise<ScoreState> {
  const { override } = opts;
  const set = override
    ? [...files.filter((f) => f.path !== override.path), override]
    : files;
  const asOf = isoUtc(opts.asOf);
  const state: ScoreState = { ...computeScore(extractAll(set)), asOf };

  const { data } = await db.from('current_state').select('value').eq('key', SCORE_KEY).maybeSingle();
  const prev = data?.value as ScoreState | undefined;
  /* Same commit or newer replaces; older is dropped. A new day with no new
     commit (the midnight refresh) still writes, so the week rolls over. */
  if (prev?.asOf && prev.asOf > asOf) return prev;
  const same = prev && JSON.stringify({ ...prev, asOf: '' }) === JSON.stringify({ ...state, asOf: '' });
  if (same && prev?.asOf === asOf) return state;
  const { error } = await db
    .from('current_state')
    .upsert({ key: SCORE_KEY, value: state, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(`${SCORE_KEY}: ${error.message}`);
  return state;
}
