-- ====================================================================
-- Migration 0016 — Living entries (Living surface group)
--
-- The Living menu group currently hosts /food (a static gallery). This
-- table backs additional Living surfaces that are individual long-form
-- documents, each rendered as its own top-level page.
--
-- v1 entries: bucket-list, field-atlas.
--
-- Vault path: living/<slug>.md, frontmatter:
--   title:    required
--   summary:  optional (short kicker / dek)
--   order:    optional (sort order; lower first; defaults to 99)
--
-- The vault syncer upserts one row per file. Each row drives a
-- top-level route at /<slug>; the route handler reads the row and
-- renders body through renderMarkdown(). Slugs are stable and the
-- routes are explicit (not [slug]) so they can carry custom metadata
-- and per-entry layout treatment when the doc warrants it.
-- ====================================================================

create table if not exists public.living_entries (
  slug             text primary key,
  title            text not null,
  summary          text,
  body             text not null,
  order_idx        integer not null default 99,
  last_edited_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists living_entries_order_idx
  on public.living_entries (order_idx);

alter table public.living_entries enable row level security;

drop policy if exists "public read living_entries" on public.living_entries;
create policy "public read living_entries"
  on public.living_entries for select using (true);

drop trigger if exists touch_living_entries_updated_at on public.living_entries;
create trigger touch_living_entries_updated_at
  before update on public.living_entries
  for each row execute function public.touch_updated_at();
