/*
 * Seed script — push every entry from lib/data/* into Postgres.
 *
 * Idempotent: every upsert is on the slug column, so re-running just
 * updates existing rows. Safe to run repeatedly during dev.
 *
 *   npm run seed
 */

import { getServerAdminClient } from '../lib/supabase';
import { toRow } from '../lib/db-mappers';

import { NOTEBOOK_POSTS, NOTEBOOK_THREADS } from '../lib/data/notebook';
import { BOOKS } from '../lib/data/library';
import { PROJECTS } from '../lib/data/projects';
import { MENTAL_MODELS } from '../lib/data/mental-models';
import {
  STUDY_CREDENTIALS, STUDY_DOMAINS, PUBLICATIONS, CONFERENCES,
} from '../lib/data/study';
import {
  MOTTO, STORY_VIGNETTES, LIFE_PRINCIPLES,
  JOURNEY, LIFE_GOALS, CHANGED_MY_MIND,
} from '../lib/data/life';

import { deriveAndWriteLiveState } from '../lib/content/derive';

const db = getServerAdminClient();

/* -- Helpers --------------------------------------------------------- */
async function upsert(
  table: string,
  rows: object[],
  conflict = 'slug',
) {
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows (skipped)`);
    return;
  }
  const { error } = await db.from(table).upsert(rows, { onConflict: conflict });
  if (error) {
    console.error(`  ${table}: error — ${error.message}`);
    throw error;
  }
  console.log(`  ${table}: ${rows.length} rows ✓`);
}

async function deleteAll(table: string) {
  // Clear table before inserts that don't have a stable PK (journey, motto)
  const { error } = await db.from(table).delete().not('id', 'is', null);
  if (error) throw error;
}

/* -- Run ------------------------------------------------------------- */
async function main() {
  console.log('Seeding husayngokal.com Postgres from lib/data/* …\n');

  console.log('Notebook:');
  await upsert('notebook_threads', NOTEBOOK_THREADS.map(toRow.notebookThread));
  await upsert('notebook_posts',   NOTEBOOK_POSTS.map(toRow.notebookPost));

  console.log('\nLibrary:');
  await upsert('library_books', BOOKS.map(toRow.book));

  console.log('\nProjects:');
  await upsert('projects', PROJECTS.map(toRow.project));

  console.log('\nMental Models:');
  await upsert('mental_models', MENTAL_MODELS.map(toRow.mentalModel));

  console.log('\nStudy Log:');
  await upsert('study_credentials', STUDY_CREDENTIALS.map(toRow.studyCredential));
  await upsert('study_domains',     STUDY_DOMAINS.map(toRow.studyDomain));
  await upsert('publications',      PUBLICATIONS.map(toRow.publication));
  await upsert('conferences',       CONFERENCES.map(toRow.conference));

  console.log('\nLife Plan:');
  await upsert('life_principles',     LIFE_PRINCIPLES.map(toRow.lifePrinciple));
  await upsert(
    'life_story_vignettes',
    STORY_VIGNETTES.map((v, i) => toRow.storyVignette(v, i)),
  );
  // Journey + motto don't have stable slugs, so clear and re-insert
  await deleteAll('life_journey_entries');
  await upsert(
    'life_journey_entries',
    JOURNEY.map((j, i) => toRow.journeyEntry(j, i)),
    'id',
  );
  await upsert('life_goals',          LIFE_GOALS.map(toRow.lifeGoal));
  await upsert('life_changed_mind',   CHANGED_MY_MIND.map(toRow.changedMyMind));

  // Motto: write the current one and deactivate older ones
  await db.from('life_motto').update({ active: false }).eq('active', true);
  await db.from('life_motto').insert({
    text: MOTTO.text, language: MOTTO.language, active: true,
  });
  console.log('  life_motto: 1 row ✓');

  /* -- Live-state derivation --------------------------------------- */
  console.log('\nLive state:');
  const derived = await deriveAndWriteLiveState(db);
  for (const [k, v] of Object.entries(derived.written)) {
    console.log(`  current_state[${k}]: ${v ? 'set' : 'cleared'} ✓`);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('\nSeed failed:');
  console.error(err);
  process.exit(1);
});
