-- ====================================================================
-- Migration 0006 — wikilinks enrichment
--   * Adds source_title and source_url so backlink rendering can avoid
--     a second join against the source table for every detail page.
--   * Adds target_title / target_url for the same reason on forward
--     references, which the post page also lists ("references" rail).
--   * Adds a uniqueness constraint so the sync's full-rebuild path
--     can use upsert-on-conflict instead of truncate-then-insert.
-- ====================================================================

alter table public.wikilinks add column if not exists source_title text;
alter table public.wikilinks add column if not exists source_url   text;
alter table public.wikilinks add column if not exists target_title text;
alter table public.wikilinks add column if not exists target_url   text;

-- Idempotency on rebuild: each (source -> target) pair is unique.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wikilinks_edge_unique'
  ) then
    alter table public.wikilinks
      add constraint wikilinks_edge_unique
      unique (source_table, source_slug, target_table, target_slug);
  end if;
end $$;
