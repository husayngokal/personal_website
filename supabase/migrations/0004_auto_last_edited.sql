--
-- Auto last-edited — each content row gets a `last_edited_at` column
-- populated from the GitHub commit history of its source .md file
-- during vault sync. Replaces the manual frontmatter `last-active`
-- dance on projects.
--
-- The vault syncer (lib/vault/sync.ts) fetches the most recent commit
-- for each file via the GitHub commits API and writes the timestamp
-- into last_edited_at. The derive function then uses last_edited_at
-- instead of frontmatter dates for "currently building" and similar.
--

alter table public.projects        add column if not exists last_edited_at timestamptz;
alter table public.notebook_posts  add column if not exists last_edited_at timestamptz;
alter table public.library_books   add column if not exists last_edited_at timestamptz;
alter table public.mental_models   add column if not exists last_edited_at timestamptz;
alter table public.courses         add column if not exists last_edited_at timestamptz;
alter table public.study_credentials add column if not exists last_edited_at timestamptz;
alter table public.study_domains   add column if not exists last_edited_at timestamptz;
alter table public.life_principles add column if not exists last_edited_at timestamptz;
alter table public.life_goals      add column if not exists last_edited_at timestamptz;
