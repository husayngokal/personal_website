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
import { writeStateIfChanged } from '../content/vault-state';
import { computeScore, type ScoreState } from './compute';
import { extractAll } from './items';
import type { VaultFile } from '../vault/tarball';

export const SCORE_KEY = 'score';

export async function readScore(db: SupabaseClient): Promise<ScoreState | null> {
  const { data } = await db.from('current_state').select('value').eq('key', SCORE_KEY).maybeSingle();
  const v = data?.value as ScoreState | undefined;
  return v && v.version === 1 ? v : null;
}

/** Recompute from a full set of vault files and store it. `override`
 *  replaces one file's content: the file a Studio tap just committed,
 *  which the tarball may not show yet. */
export async function recomputeScore(
  db: SupabaseClient, files: VaultFile[], override?: VaultFile,
): Promise<ScoreState> {
  const set = override
    ? [...files.filter((f) => f.path !== override.path), override]
    : files;
  const state = computeScore(extractAll(set));
  await writeStateIfChanged(db, SCORE_KEY, state);
  return state;
}
