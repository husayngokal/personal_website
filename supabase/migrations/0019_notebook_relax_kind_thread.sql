-- ====================================================================
-- 0019 — Notebook becomes essays only: STEP 1 of 2 (relaxation)
--
-- RUN THIS FIRST, while the current code is still deployed. Every
-- statement here is a pure relaxation, so the running parser (which
-- still sends `kind` and `thread`) keeps working untouched.
--
-- Ordering matters and the failure is silent. lib/vault/sync.ts throws
-- on a failed upsert, and app/api/vault/webhook already returned
-- 200 before running the sync inside after(). A broken sync therefore
-- shows up as a GREEN webhook delivery in GitHub with no alert. Run the
-- four steps in order:
--
--   1. this migration
--   2. push the vault (threads folder deleted, `thread:` stripped,
--      `type: essay` set on every notebook file)
--   3. deploy the code
--   4. migration 0020 (the actual drops)
--
-- Why the split: notebook_posts.kind is `not null` with NO default
-- (0001_initial.sql:38). The moment the new parser stops sending it,
-- every notebook upsert fails with 23502 unless the column has been
-- made nullable first. Likewise notebook_posts.thread carries an FK to
-- notebook_threads (0001_initial.sql:43); dropping it here is what makes
-- the vault push in step 2 unconditionally safe.
-- ====================================================================

-- ---- Fold the ten notes into essays --------------------------------
-- The vault push in step 2 sets `type: essay` on the same ten files, so
-- the source of truth and the database agree either way. Doing it here
-- as well means the site is correct in the window between the two.
update public.notebook_posts
   set kind = 'essay'
 where kind is distinct from 'essay';

-- ---- Relax the two constraints the new parser would violate --------
alter table public.notebook_posts
  drop constraint if exists notebook_posts_thread_fkey;

alter table public.notebook_posts
  drop constraint if exists notebook_posts_kind_check;

alter table public.notebook_posts
  alter column kind drop not null;

alter table public.notebook_posts
  alter column kind set default 'essay';

-- ---- Verify before moving on ---------------------------------------
--   select kind, count(*) from public.notebook_posts group by kind;
--   -- expect exactly one row: essay | 20
