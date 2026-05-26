--
-- 0015 — study_credentials.exam_date
--
-- Adds an optional exam_date column so the typewriter's currently_studying
-- slot (and the matching homepage rail) can pick the next pending credential
-- automatically, ordered by upcoming exam. Replaces the previously hardcoded
-- ICS_CRED_SLUG / ICS_EXAM_DATE pair in lib/content/derive.ts — that worked
-- for the single-credential case but doesn't generalise to "now studying for
-- SQE 1 after ICS." The vault parser writes this from each file's
-- `exam-date:` frontmatter on the next sync.

alter table public.study_credentials
  add column if not exists exam_date date;
