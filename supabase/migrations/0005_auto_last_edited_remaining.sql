--
-- last_edited_at on the remaining content tables I missed in 0004.
-- Vault sync attaches last_edited_at to *every* parsed row's payload
-- (since every file has a git commit date), so every content table
-- needs the column.
--

alter table public.life_changed_mind     add column if not exists last_edited_at timestamptz;
alter table public.life_story_vignettes  add column if not exists last_edited_at timestamptz;
alter table public.life_journey_entries  add column if not exists last_edited_at timestamptz;
alter table public.life_motto            add column if not exists last_edited_at timestamptz;
alter table public.notebook_threads      add column if not exists last_edited_at timestamptz;
alter table public.publications          add column if not exists last_edited_at timestamptz;
alter table public.conferences           add column if not exists last_edited_at timestamptz;
