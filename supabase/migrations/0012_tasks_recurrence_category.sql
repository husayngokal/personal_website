-- ====================================================================
-- Migration 0012 — tasks: add recurrence + category columns
--
-- The first cut of /life/tasks shipped without a way to mark recurring
-- routines (daily shutdown, weekly review, etc.) or to group tasks by
-- domain category (the 9 buckets from Part 15: software, ai, math,
-- physics, electronics, cybersecurity, systems, philosophy, public).
--
-- ALTER instead of recreating because production already has rows
-- from the initial vault sync; both new columns are nullable so the
-- existing rows stay valid.
-- ====================================================================

alter table public.tasks
  add column if not exists recurrence text
    check (recurrence is null or recurrence in ('daily','weekly','monthly','quarterly','yearly'));

alter table public.tasks
  add column if not exists category text;

create index if not exists tasks_recurrence_idx on public.tasks (recurrence);
create index if not exists tasks_category_idx   on public.tasks (category);
