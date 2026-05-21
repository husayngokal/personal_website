--
-- husayngokal.com — initial schema
--
-- Schema for the six content surfaces plus the comment moderation queue
-- and the live-state table that powers the homepage rails. Matches
-- BRIEF.md Appendix D (YAML frontmatter schemas).
--
-- Apply once via: Supabase Dashboard → SQL Editor → paste this file → Run.
-- Subsequent migrations go in /supabase/migrations/0002_*.sql etc.
--
-- RLS posture: every content table is public-read (anyone can browse the
-- site). Writes to content tables happen server-side only (vault → webhook
-- → secret-key client). Comments + current_state are write-restricted to
-- the secret-key client; comments are not public-read either (only the
-- author sees the moderation queue, via Obsidian sync).

-- ====================================================================
-- Extensions
-- ====================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ====================================================================
-- Notebook
-- ====================================================================

create table if not exists public.notebook_threads (
  slug         text primary key,
  name         text not null,
  summary      text not null,
  state        text not null check (state in ('active','dormant','concluded')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.notebook_posts (
  slug             text primary key,
  kind             text not null check (kind in ('essay','note')),
  title            text not null,
  dek              text,
  date             date not null,
  updated          date,
  thread           text references public.notebook_threads(slug) on delete set null,
  tags             text[],
  epistemic_status text,
  draft            boolean not null default false,
  word_count       integer,
  body             text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists notebook_posts_date_idx on public.notebook_posts (date desc);
create index if not exists notebook_posts_thread_idx on public.notebook_posts (thread);

-- ====================================================================
-- Library
-- ====================================================================

create table if not exists public.library_books (
  slug          text primary key,
  title         text not null,
  author        text not null,
  isbn          text,
  status        text not null check (status in ('planned','reading','finished','abandoned','re-reading','wishlist')),
  year          integer not null,
  started       date,
  finished      date,
  rating        integer check (rating between 1 and 5),
  genre         text[],
  language      text,
  source        text,
  progress_pct  integer check (progress_pct between 0 and 100),
  notes         text,
  review        text,
  passages      jsonb,                                  -- [{text, page}]
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists library_books_year_idx on public.library_books (year);
create index if not exists library_books_status_idx on public.library_books (status);

-- ====================================================================
-- Projects
-- ====================================================================

create table if not exists public.projects (
  slug          text primary key,
  title         text not null,
  tagline       text not null,
  status        text not null check (status in ('active','paused','dormant','concluded','shipped','dead')),
  started       date,
  ended         date,
  tags          text[],
  repo          text,
  repo_private  boolean not null default false,
  external_url  text,
  last_active   date not null,
  current_state text,
  stuck_on      text[],
  tasks         jsonb,                                   -- {backlog,inProgress,done}
  activity      jsonb,                                   -- [{date,line,branch}]
  decisions     jsonb,                                   -- [{date,title,body}]
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ====================================================================
-- Mental Models
-- ====================================================================

create table if not exists public.mental_models (
  slug              text primary key,
  title             text not null,
  origin            text,
  type              text not null check (type in ('curated','original','hybrid')),
  related           text[],
  tags              text[],
  last_reviewed     date,
  depth             text check (depth in ('dabbled','learning','working-in','teaching-from','decayed')),
  one_line          text not null,
  body              text,
  framing           text,
  when_to_reach     text[],
  when_not_to       text[],
  in_the_wild       jsonb,                               -- [{href,label,sub}]
  sources           jsonb,                               -- [{href?,label}]
  changed_my_mind   jsonb,                               -- [{date,body}]
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ====================================================================
-- Study Log
-- ====================================================================

create table if not exists public.study_credentials (
  slug          text primary key,
  title         text not null,
  full_title    text,
  institution   text not null,
  earned        date,
  pending       boolean not null default false,
  expires       date,
  depth         text not null check (depth in ('dabbled','learning','working-in','teaching-from','decayed')),
  last_assessed date not null,
  tags          text[],
  what_stuck    text not null,
  what_didnt    text not null,
  sources       jsonb,                                   -- [{href?,label}]
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.study_domains (
  slug          text primary key,
  title         text not null,
  depth         text not null check (depth in ('dabbled','learning','working-in','teaching-from','decayed')),
  body          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.publications (
  slug     text primary key,
  title    text not null,
  venue    text not null,
  year     integer not null,
  authors  text not null,
  href     text,
  created_at timestamptz not null default now()
);

create table if not exists public.conferences (
  slug   text primary key,
  name   text not null,
  year   integer not null,
  role   text not null,
  talk   text,
  created_at timestamptz not null default now()
);

-- ====================================================================
-- Life Plan
-- ====================================================================

create table if not exists public.life_principles (
  slug         text primary key,
  title        text not null,
  order_       integer not null,
  manifesto    text not null,
  body         text,
  established  date,
  revised      date,
  tags         text[],
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.life_story_vignettes (
  slug       text primary key,
  title      text not null,
  body       text not null,
  ordinal    integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_journey_entries (
  id          uuid primary key default gen_random_uuid(),
  date        text not null,                            -- "May 2026" / "2024" / etc — free-form per Part XI
  title       text not null,
  reflection  text,
  ordinal     integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.life_goals (
  slug    text primary key,
  scale   text not null check (scale in ('lifetime','five-year','this-year','this-quarter','this-month')),
  year    integer,
  title   text not null,
  status  text not null check (status in ('completed','partially-completed','dropped','rolled-over','in-progress','planned')),
  note    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_changed_mind (
  slug          text primary key,
  title         text not null,
  date_changed  date not null,
  previous      text not null,
  next_         text not null,
  tags          text[],
  created_at    timestamptz not null default now()
);

-- The motto itself — single-row table so revisions appear in created_at order
create table if not exists public.life_motto (
  id         uuid primary key default gen_random_uuid(),
  text       text not null,
  language   text not null default 'en',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ====================================================================
-- Wikilinks graph (rebuilt on every vault sync)
-- ====================================================================

create table if not exists public.wikilinks (
  id             uuid primary key default gen_random_uuid(),
  source_slug    text not null,
  source_table   text not null,
  target_slug    text not null,
  target_table   text not null,
  link_text      text,
  created_at     timestamptz not null default now()
);
create index if not exists wikilinks_target_idx on public.wikilinks (target_table, target_slug);
create index if not exists wikilinks_source_idx on public.wikilinks (source_table, source_slug);

-- ====================================================================
-- Comments — PR-style submission moderation queue
-- ====================================================================

create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  post_slug    text not null,                          -- the post the comment was submitted on
  body         text not null,
  email        text not null,
  name         text,
  status       text not null default 'pending' check (status in ('pending','accepted','rejected')),
  ip_hash      text,                                    -- sha256 of IP for rate limiting; not the raw IP
  user_agent   text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);
create index if not exists comments_status_idx on public.comments (status, created_at desc);

-- ====================================================================
-- Live state — homepage rails / typewriter signals
-- ====================================================================

create table if not exists public.current_state (
  key        text primary key,                          -- 'currently_reading' | 'currently_building' | 'currently_studying' | 'currently_writing' | 'currently_listening'
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed the five keys with empty values so subscribers always have a row
insert into public.current_state (key, value) values
  ('currently_reading',   '{}'::jsonb),
  ('currently_building',  '{}'::jsonb),
  ('currently_studying',  '{}'::jsonb),
  ('currently_writing',   '{}'::jsonb),
  ('currently_listening', '{}'::jsonb)
on conflict (key) do nothing;

-- ====================================================================
-- Row-Level Security
-- ====================================================================

-- Content tables: enable RLS, then add a public-read policy.
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'notebook_posts','notebook_threads',
      'library_books',
      'projects',
      'mental_models',
      'study_credentials','study_domains','publications','conferences',
      'life_principles','life_story_vignettes','life_journey_entries',
      'life_goals','life_changed_mind','life_motto',
      'wikilinks','current_state'
    ])
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "public read" on public.%I;', t);
    execute format('create policy "public read" on public.%I for select using (true);', t);
  end loop;
end $$;

-- Comments: RLS on, no public policies — only the secret key can touch it.
alter table public.comments enable row level security;

-- ====================================================================
-- Realtime publication
-- ====================================================================
-- Broadcast current_state changes to subscribed clients (homepage rails).
-- Other tables update via the vault webhook with full re-render; they
-- don't need per-row push.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Idempotent add; ignore errors if already in publication
    begin
      alter publication supabase_realtime add table public.current_state;
    exception when others then null;
    end;
  end if;
end $$;

-- ====================================================================
-- updated_at triggers (touch updated_at on row update)
-- ====================================================================

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'notebook_posts','notebook_threads',
      'library_books',
      'projects',
      'mental_models',
      'study_credentials','study_domains',
      'life_principles','life_story_vignettes',
      'life_goals',
      'current_state'
    ])
  loop
    execute format('drop trigger if exists trg_touch_%I on public.%I;', t, t);
    execute format(
      'create trigger trg_touch_%I before update on public.%I '
      'for each row execute function public.touch_updated_at();',
      t, t
    );
  end loop;
end $$;
