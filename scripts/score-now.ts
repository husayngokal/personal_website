/*
 * score-now: recompute the weekly score from the vault on GitHub and
 * store it, without a full sync.
 *
 *   npm run score
 *
 * Same code path as the sync's score step (lib/score). Prints the week,
 * the lifetime total and what is on the plate.
 */

import { getServerAdminClient } from '../lib/supabase';
import { fetchVaultMarkdown } from '../lib/vault/tarball';
import { recomputeScore } from '../lib/score/store';

async function main() {
  const db = getServerAdminClient();
  const s = await recomputeScore(db, await fetchVaultMarkdown());
  console.log(`week of ${s.week.start}: ${s.week.bar} / ${s.bar} (quests ${s.week.quest}, curiosity ${s.week.curiosityCounted} of ${s.curiosityCap})`);
  console.log(`lifetime ${s.lifetime.points}, level ${s.lifetime.level}, ${s.streak} full weeks in a row`);
  for (const i of s.items) {
    console.log(`${i.active ? 'on plate' : '        '}  ${i.lane.padEnd(9)} ${i.title.padEnd(36).slice(0, 36)}  ${i.summary}${i.weekPoints ? `  +${i.weekPoints}` : ''}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
