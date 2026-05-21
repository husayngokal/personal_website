-- ====================================================================
-- Migration 0008 — writeups surface
--
-- A unified knowledge base for technical security content:
--   * kind=machine    — box writeups (HackTheBox, TryHackMe, VulnHub, CTF)
--                       carrying difficulty/OS/status/points/IP
--   * kind=technique  — tool references, methodology, concept notes,
--                       technique writeups; the box-specific fields stay
--                       null
--
-- The schema is permissive: box-specific fields are nullable, with the
-- parser (lib/vault/parse.ts) enforcing the right shape per `kind` at
-- ingestion time. category is a free-text label used as a sidebar
-- filter facet for technique entries (tool / methodology / concept /
-- reconnaissance / exploitation / reference / …).
-- ====================================================================

create table if not exists public.writeups (
  slug           text primary key,
  title          text not null,
  kind           text not null default 'technique'
                 check (kind in ('machine','technique')),
  category       text,                    -- technique faceting (tool, methodology, …)
  platform       text,                    -- htb | thm | vulnhub | portswigger | ctf | other  (machine only)
  difficulty     text,                    -- easy | medium | hard | insane  (machine only)
  os             text,                    -- linux | windows | other        (machine only)
  points         integer,                 -- machine only
  status         text,                    -- rooted | foothold | attempted | abandoned  (machine only)
  date           date,
  ip             text,                    -- machine only, optional
  tags           text[],
  techniques     text[],
  body           text,
  last_edited_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists writeups_kind_idx       on public.writeups (kind);
create index if not exists writeups_category_idx   on public.writeups (category);
create index if not exists writeups_platform_idx   on public.writeups (platform);
create index if not exists writeups_difficulty_idx on public.writeups (difficulty);
create index if not exists writeups_status_idx     on public.writeups (status);
create index if not exists writeups_date_idx       on public.writeups (date desc);

alter table public.writeups enable row level security;

drop policy if exists "public read writeups" on public.writeups;
create policy "public read writeups" on public.writeups for select using (true);

drop trigger if exists touch_writeups_updated_at on public.writeups;
create trigger touch_writeups_updated_at
  before update on public.writeups
  for each row execute function public.touch_updated_at();
