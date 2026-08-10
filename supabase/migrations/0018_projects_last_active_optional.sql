-- Make projects.last_active optional.
--
-- Previously required, which meant the author had to bump it every day to
-- keep a project reading as "active today". Now: absent = "active today",
-- computed at view time (zero maintenance); set a real date only to show a
-- project as last active in the past.
alter table public.projects alter column last_active drop not null;
