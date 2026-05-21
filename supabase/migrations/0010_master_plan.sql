-- ====================================================================
-- Migration 0010 — Master Plan (life surface, /life/plan)
--
-- The 883-page operating document, split into 18 Parts. Vault path:
--   /life/master-plan/NN-slug.md  (frontmatter: part, title, slug)
--
-- The vault syncer parses each file into one row keyed on slug; the
-- detail page /life/plan/[slug] renders the body markdown through the
-- standard renderMarkdown pipeline.
--
-- The fallback at lib/data/master-plan.ts is a build-time snapshot so
-- the site continues to render the plan when Supabase is offline or
-- before this table has been populated.
-- ====================================================================

create table if not exists public.life_master_plan (
  slug             text primary key,
  part_number      integer not null,
  title            text not null,
  body             text not null,
  summary          text,
  last_edited_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists life_master_plan_part_idx
  on public.life_master_plan (part_number);

alter table public.life_master_plan enable row level security;

drop policy if exists "public read life_master_plan" on public.life_master_plan;
create policy "public read life_master_plan"
  on public.life_master_plan for select using (true);

drop trigger if exists touch_life_master_plan_updated_at on public.life_master_plan;
create trigger touch_life_master_plan_updated_at
  before update on public.life_master_plan
  for each row execute function public.touch_updated_at();
