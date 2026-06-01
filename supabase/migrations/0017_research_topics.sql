-- ====================================================================
-- Migration 0017 — Research topics surface
--
-- Per the new /research route: each row is a research topic the
-- author is actively gathering material on. The vault file is the
-- working bookmarks page for that topic plus working notes; the body
-- is markdown rendered through the standard pipeline.
--
-- This is the "live bookmarks" surface: topic-level clusters of
-- resources (papers, articles, videos, repos, podcasts) that the
-- author intends to synthesise into written output downstream.
--
-- Distinct from the future per-paper Research Paper Library proposed
-- in /ideas/research-paper-library: that's the heavier surface where
-- each paper gets its own page with reproducibility, AI summary, and
-- credibility check. This is the lighter, faster-moving cluster view.
--
-- Vault path: research/<slug>.md, frontmatter:
--   title:    required
--   summary:  optional
--   status:   required, one of gathering | exploring | writing | shipped | dormant
--   started:  optional ISO date
--   tags:     optional string array
-- ====================================================================

create table if not exists public.research_topics (
  slug             text primary key,
  title            text not null,
  summary          text,
  status           text not null,
  started          date,
  tags             text[],
  body             text not null default '',
  last_edited_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists research_topics_status_idx
  on public.research_topics (status);

alter table public.research_topics enable row level security;

drop policy if exists "public read research_topics" on public.research_topics;
create policy "public read research_topics"
  on public.research_topics for select using (true);

drop trigger if exists touch_research_topics_updated_at on public.research_topics;
create trigger touch_research_topics_updated_at
  before update on public.research_topics
  for each row execute function public.touch_updated_at();
