-- Electrical Engineering lists from docs/new titles are completed projects.
-- The earlier-project list already allows Computer Engineering and Electronics.

alter table public.last_year_projects drop constraint if exists last_year_projects_programme_check;

alter table public.last_year_projects
  add constraint last_year_projects_programme_check
  check (programme = any (array['ETE'::text, 'COE'::text, 'EE'::text]));
