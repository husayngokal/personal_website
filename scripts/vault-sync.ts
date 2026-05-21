/*
 * Pull the vault from GitHub and apply changes to Postgres.
 *
 *   npm run vault:sync
 *
 * Idempotent — running it twice in a row should report the same upsert
 * counts and zero deletes/errors. Use it locally during development;
 * production uses the webhook for incremental, low-latency updates.
 */

import { syncVault } from '../lib/vault/sync';

async function main() {
  console.log('Syncing vault from GitHub ...\n');
  const result = await syncVault();

  console.log(`Parsed ${result.parsed} files.\n`);
  console.log('Upserts:');
  for (const [table, n] of Object.entries(result.upserted)) {
    console.log(`  ${table}: ${n}`);
  }
  if (Object.keys(result.deleted).length > 0) {
    console.log('\nDeletions:');
    for (const [table, n] of Object.entries(result.deleted)) {
      console.log(`  ${table}: ${n}`);
    }
  }
  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const w of result.warnings) console.log(`  ${w}`);
  }
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    for (const e of result.errors) console.log(`  ${e.path}: ${e.message}`);
    process.exit(1);
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
