-- ====================================================================
-- Migration 0011 — public tasks (accountability surface)
--
-- Tasks are what the author is actively working on, published
-- publicly for accountability. Edits flow through the standard
-- vault webhook (no public auth UI), so the table only needs
-- read-anonymous RLS — writes are service-role-only via the syncer.
--
-- The scope axis (today → lifetime) parallels the goals scale but
-- at finer granularity; a goal is "ship a serious paper this year",
-- a task is "draft section 2 of the paper today."
-- ====================================================================

create table if not exists public.tasks (
  slug             text primary key,
  title            text not null,
  status           text not null
                   check (status in ('open','in-progress','done','dropped','blocked')),
  scope            text not null
                   check (scope in ('today','this-week','this-month','this-quarter','this-year','lifetime')),
  priority         integer,                -- 1 = high, 2 = mid, 3 = low
  project          text,                   -- optional project slug link
  due              text,                   -- ISO date when the task is due
  completed        text,                   -- ISO date when status flipped to 'done'
  notes            text,                   -- markdown body, rendered inline
  ordinal          integer,                -- sort order within scope
  last_edited_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_scope_idx  on public.tasks (scope);
create index if not exists tasks_project_idx on public.tasks (project);

alter table public.tasks enable row level security;

drop policy if exists "public read tasks" on public.tasks;
create policy "public read tasks"
  on public.tasks for select using (true);

drop trigger if exists touch_tasks_updated_at on public.tasks;
create trigger touch_tasks_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();
