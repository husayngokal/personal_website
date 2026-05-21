-- ====================================================================
-- Migration 0013 — credentials: file_path is now optional
--
-- LinkedIn-imported certifications carry only a verification URL and
-- no downloadable PDF. The detail page handles the missing-file case
-- (promotes the verify link to the primary CTA, skips the inline PDF
-- preview). This migration drops the NOT NULL constraint on file_path
-- so those rows can land cleanly via the vault syncer.
-- ====================================================================

alter table public.credentials
  alter column file_path drop not null;
