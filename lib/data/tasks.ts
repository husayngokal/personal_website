import type { Task } from '../types';

/*
 * Tasks fallback data — used when Supabase is offline or before the
 * tasks table has been populated. The vault's /tasks/*.md files are
 * the canonical source. Seed entries below show the schema; add more
 * to the vault and they'll appear automatically via the syncer.
 */

export const TASKS: Task[] = [
  {
    slug: 'finish-master-plan-import',
    title: 'Finish wiring the Master Plan import (18 Parts)',
    status: 'done',
    scope: 'this-week',
    priority: 1,
    ordinal: 10,
    completed: '2026-05-17',
    notes:
      'Extracted from the 883-page PDF, cleaned through pandoc + heading-restoration, ' +
      'shipped as /life/plan with one detail page per Part. Done.',
  },
  {
    slug: 'ship-public-tasks',
    title: 'Ship the public tasks surface (this thing)',
    status: 'in-progress',
    scope: 'today',
    priority: 1,
    ordinal: 1,
    notes:
      'Schema + getter + parser + index page + vault folder. ' +
      'Accountability mechanism: every task here is something I can be ' +
      'asked about by anyone reading the site.',
  },
  {
    slug: 'wire-location-auto-sync',
    title: 'Wire the iOS Shortcut for location auto-sync',
    status: 'open',
    scope: 'this-week',
    priority: 2,
    ordinal: 20,
    notes:
      'Shortcut posts current location to /api/location every ~30 min ' +
      'while the device is awake. Needs LOCATION_AUTH_TOKEN on Vercel.',
  },
];
