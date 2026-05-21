# Supabase

Schema migrations and seed scripts for the Postgres backing the site.

## Apply a migration

Supabase doesn't get a CLI install dependency here — apply via the dashboard:

1. Open the project's **SQL Editor** (Dashboard → SQL → New query)
2. Paste the contents of the next un-applied migration file in `migrations/`, in numeric order
3. Click **Run**
4. Verify success — the editor will show errors if any statement failed

`0001_initial.sql` is idempotent on re-runs (`create table if not exists`, `on conflict do nothing`, policy drops before creation, etc.). You can re-run it safely.

## Order of work

1. `0001_initial.sql` — schema for the six content surfaces, comments queue, live-state table, RLS policies, Realtime publication, `updated_at` triggers
2. Seed — run `npm run seed` (added once migration is applied) to populate the tables from `lib/data/*.ts`

## What lives where

| Table | Source of truth | RLS |
| --- | --- | --- |
| `notebook_*`, `library_books`, `projects`, `mental_models`, `study_*`, `publications`, `conferences`, `life_*` | Obsidian vault → vault webhook | public read |
| `wikilinks` | Computed on every vault sync | public read |
| `current_state` | Spotify / GitHub / vault-commit jobs | public read; service-role write |
| `comments` | Reader submissions via `/api/notebook/submit` | service-role only (queue is private) |

## Realtime channels

`current_state` is the only table in the `supabase_realtime` publication. The homepage subscribes to it; updates push within seconds. Other tables update via full vault re-sync.
