-- ====================================================================
-- Migration 0007 — book covers + current location
--
-- 1. library_books.cover_url       — optional image URL (manual via
--    vault frontmatter `cover-url:` or auto-derived by sync.ts from
--    the book's ISBN against Open Library).
--
-- 2. A `current_location` row in current_state is what feeds the top
--    nav's status pulse. Seeded here so first request after this
--    migration doesn't fall back to the hardcoded default. Updated
--    by either /api/location or by editing life/location.md.
-- ====================================================================

alter table public.library_books add column if not exists cover_url text;

insert into public.current_state (key, value)
values (
  'current_location',
  jsonb_build_object(
    'city', 'Sharjah',
    'country', 'United Arab Emirates',
    'timezone', 'Asia/Dubai'
  )
)
on conflict (key) do nothing;
