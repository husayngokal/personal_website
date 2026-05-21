-- ====================================================================
-- Migration 0014 — ideas (proposals for the website itself)
--
-- Live ideation log. Each row is one proposal for a feature, surface,
-- or adjacent project the author is considering. Status moves through
-- open → exploring → building → shipped (or dropped). Vault path:
-- /ideas/<slug>.md.
-- ====================================================================

create table if not exists public.ideas (
  slug             text primary key,
  title            text not null,
  summary          text not null,             -- one-sentence pitch
  status           text not null
                   check (status in ('open','exploring','building','shipped','dropped')),
  proposed         text not null,             -- ISO date YYYY-MM-DD
  tags             text[],
  body             text,                      -- full markdown writeup
  shipped_as       text,                      -- URL if shipped (link to live feature)
  last_edited_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists ideas_status_idx   on public.ideas (status);
create index if not exists ideas_proposed_idx on public.ideas (proposed desc);

alter table public.ideas enable row level security;

drop policy if exists "public read ideas" on public.ideas;
create policy "public read ideas"
  on public.ideas for select using (true);

drop trigger if exists touch_ideas_updated_at on public.ideas;
create trigger touch_ideas_updated_at
  before update on public.ideas
  for each row execute function public.touch_updated_at();
