--
-- Newsletter — weekly digest of vault changes.
--
-- Subscribers store an email + a tokenised unsubscribe key. RLS is on
-- and no public policies are defined: only the service-role server can
-- touch this table. The /api/newsletter/subscribe endpoint inserts
-- rows; /api/newsletter/unsubscribe marks them unsubscribed by token.
--
-- For now, status defaults to 'confirmed' (single opt-in) — when Resend
-- is wired the subscribe endpoint will switch to 'pending' and send a
-- confirmation email with the same token.
--

create table if not exists public.newsletter_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  status          text not null default 'confirmed'
                       check (status in ('pending','confirmed','unsubscribed','bounced')),
  token           text not null unique,
  ip_hash         text,
  user_agent      text,
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz default now(),
  unsubscribed_at timestamptz,
  last_email_at   timestamptz
);

create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status, last_email_at);

alter table public.newsletter_subscribers enable row level security;
-- Intentionally NO public policies.
