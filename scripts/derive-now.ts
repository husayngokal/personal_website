/*
 * derive-now — manually re-run the live-state derivation against
 * Postgres without going through a full vault sync.
 *
 *   npm run derive
 *
 * Useful when:
 *   - Spotify went silent and you want to clear the listening row
 *   - You manually edited a library_book / project / task in the DB
 *     and want the homepage typewriter to reflect it before the
 *     next sync runs
 *   - You're debugging the derive logic itself (compare before/after
 *     by capturing the printed JSON)
 *
 * Output: one JSON blob showing what was written to each
 * current_state key (or null if cleared).
 */

import { getServerAdminClient } from '../lib/supabase';
import { deriveAndWriteLiveState } from '../lib/content/derive';

async function main() {
  const db = getServerAdminClient();
  const r = await deriveAndWriteLiveState(db);
  console.log(JSON.stringify(r, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
