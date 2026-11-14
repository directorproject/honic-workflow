-- Link Project files to a calendar / field-study visit (portal_events).
alter table public.portal_files
  add column if not exists event_id uuid references public.portal_events (id) on delete set null;

create index if not exists portal_files_event_idx on public.portal_files (event_id)
  where event_id is not null;

comment on column public.portal_files.event_id is
  'Optional field-study (or calendar) visit this file was captured for.';
