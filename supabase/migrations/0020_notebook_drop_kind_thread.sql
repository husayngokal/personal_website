-- ====================================================================
-- 0020 — Notebook becomes essays only: STEP 2 of 2 (the drops)
--
-- RUN THIS LAST, only after the code deploy is confirmed live. Running
-- it early makes PostgREST reject every notebook upsert with PGRST204
-- ("could not find the kind column in the schema cache"), which kills
-- the entire vault sync, not just the notebook table, and does it
-- silently behind a 200 webhook response.
--
-- Prerequisites, all of which must already be true:
--   - migration 0019 applied
--   - the vault no longer contains notebook/threads/*.md
--   - the deployed parser no longer sends `kind` or `thread`
-- ====================================================================

-- ---- Drop the thread linkage ---------------------------------------
-- The FK itself went in 0019; this removes the column and its index.
drop index if exists public.notebook_posts_thread_idx;

alter table public.notebook_posts
  drop column if exists thread;

-- ---- Drop the kind discriminator -----------------------------------
alter table public.notebook_posts
  drop column if exists kind;

-- ---- Retire notebook_threads ----------------------------------------
-- Publication membership first. Migration history only ever added
-- current_state to supabase_realtime (0001_initial.sql:336-345), so this
-- guards against a toggle made in the dashboard rather than fixing
-- anything in the migration record. Unguarded, ALTER PUBLICATION ... DROP
-- TABLE on a non-member raises and aborts the whole script.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
     where pubname    = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'notebook_threads'
  ) then
    alter publication supabase_realtime drop table public.notebook_threads;
  end if;
end $$;

-- Trigger name comes from the format('trg_touch_%I') loop at
-- 0001_initial.sql:365, not the touch_<table>_updated_at style used by
-- later migrations. Never drop public.touch_updated_at() itself: eleven
-- other tables' triggers execute it.
drop trigger if exists trg_touch_notebook_threads on public.notebook_threads;
drop policy  if exists "public read" on public.notebook_threads;

-- No CASCADE. The thread column above was the only dependency; if this
-- errors, find out what still references the table before forcing it.
drop table if exists public.notebook_threads;

-- ---- Clean the wikilink graph ---------------------------------------
-- Currently a no-op (no wikilink ever targeted a thread) but the graph
-- is rebuilt from parsed rows on every sync, so this keeps a stale edge
-- from outliving the route it points at.
delete from public.wikilinks
 where source_table = 'notebook_threads'
    or target_table = 'notebook_threads';

-- ---- Verify ----------------------------------------------------------
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'notebook_posts'
--    order by ordinal_position;
--   -- expect: slug, title, dek, date, updated, tags, epistemic_status,
--   --         draft, word_count, body, created_at, updated_at, last_edited_at
--
--   select to_regclass('public.notebook_threads');   -- expect NULL
--
-- NOTE: after this migration, 0001_initial.sql and
-- 0005_auto_last_edited_remaining.sql are no longer re-runnable
-- end to end. Both reference public.notebook_threads. They are history,
-- not a restore script; rebuild from a database backup instead.
