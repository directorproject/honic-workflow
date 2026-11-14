-- Where a file was obtained (e.g. field study site: "Muhimbili Hospital").
alter table public.portal_files
  add column if not exists obtained_place text;

comment on column public.portal_files.obtained_place is
  'Place or site where this file was obtained (e.g. Muhimbili Hospital).';
