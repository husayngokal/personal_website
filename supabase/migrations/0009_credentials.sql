-- ====================================================================
-- Migration 0009 — credentials surface
--
-- Publicly downloadable academic + professional credentials:
-- transcripts, diplomas, certificates, letters. Files live in
-- Cloudflare R2 (media.husayngokal.com); this table holds the
-- metadata + file path the listing page renders against.
--
-- The file_path column stores the path UNDER the media bucket
-- (e.g. "credentials/hid-transcript.pdf"). The site composes the
-- final URL by prefixing NEXT_PUBLIC_VAULT_MEDIA_URL.
-- ====================================================================

create table if not exists public.credentials (
  slug             text primary key,
  title            text not null,
  institution      text,
  year             integer,
  type             text not null default 'certificate'
                   check (type in ('transcript','diploma','certificate','letter','other')),
  file_path        text not null,
  date_issued      text,                 -- "2020-06" or "2020-06-15"; freeform
  description      text,                 -- short single-line summary
  verification_url text,                 -- external verifier (e.g. NCAT portal)
  is_public        boolean not null default true,
  body             text,
  last_edited_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists credentials_type_idx       on public.credentials (type);
create index if not exists credentials_institution_idx on public.credentials (institution);
create index if not exists credentials_year_idx       on public.credentials (year desc);

alter table public.credentials enable row level security;

drop policy if exists "public read credentials" on public.credentials;
create policy "public read credentials" on public.credentials for select using (is_public);

drop trigger if exists touch_credentials_updated_at on public.credentials;
create trigger touch_credentials_updated_at
  before update on public.credentials
  for each row execute function public.touch_updated_at();
