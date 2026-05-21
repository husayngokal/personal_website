--
-- Courses — university curriculum / roadmap (BRIEF.md extension).
--
-- A single table for courses from any university (MIT, Stanford, Yale,
-- Harvard, Cornell, NYU, etc). The `university` column drives the
-- filter sidebar on /courses and the small uni chip on each card.
--
-- est_total_hours is the canonical workload estimate. weekly_hours is
-- user-set (per-course OR global default) and derives eta_weeks at
-- render time. Both can be null; both are useful when present.
--
-- syllabus is a JSONB array of week/lecture entries, each free-form
-- so non-MIT courses (which structure differently) fit too:
--   [{ "week": 1, "topic": "...", "reading": "...", "deliverables": "..." }, ...]

create table if not exists public.courses (
  slug              text primary key,
  code              text,                    -- "6.006", "HUMBIO 160", null if no code
  title             text not null,
  university        text not null,           -- 'mit' | 'stanford' | 'yale' | 'harvard' | 'cornell' | 'nyu' | …
  department        text,                    -- "EECS", "Mathematics", etc.

  banner_image      text,                    -- /courses/{code}/banner.jpg or external URL
  source_url        text,                    -- OCW / OpenYale / SEE link
  video_url         text,                    -- YouTube playlist if applicable

  professors        text[],
  textbooks         jsonb,                   -- [{title, authors, edition, isbn, free_link}]
  prerequisites     text[],                  -- list of slugs of other courses

  est_total_hours   integer,                 -- canonical workload (units * 14 for MIT)
  weekly_hours      integer,                 -- user override; falls back to global default
  syllabus          jsonb,                   -- [{week, topic, reading, deliverables}]

  status            text not null default 'planned'
                       check (status in ('planned','studying','completed','abandoned')),
  started           date,
  finished          date,
  order_            integer not null default 0,    -- display order in roadmap

  tags              text[],
  body              text,                    -- markdown notes / personal framing

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists courses_university_idx on public.courses (university);
create index if not exists courses_status_idx on public.courses (status);

-- RLS — public read, server-only write
alter table public.courses enable row level security;
drop policy if exists "public read" on public.courses;
create policy "public read" on public.courses for select using (true);

-- updated_at trigger
drop trigger if exists trg_touch_courses on public.courses;
create trigger trg_touch_courses
  before update on public.courses
  for each row execute function public.touch_updated_at();
