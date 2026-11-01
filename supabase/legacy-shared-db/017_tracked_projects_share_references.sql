-- Curated references for public share links (source-find / documentation helpers).
-- Edited from the project Manage (work) page; shown read-only on the client share page.

alter table public.tracked_projects
  add column if not exists share_research_notes text,
  add column if not exists share_research_links jsonb not null default '[]'::jsonb;

comment on column public.tracked_projects.share_research_notes is
  'Free text shown on share link: context and document notes from internal research.';
comment on column public.tracked_projects.share_research_links is
  'JSON array of { "label": string, "url": string } shown as links on the share page.';
