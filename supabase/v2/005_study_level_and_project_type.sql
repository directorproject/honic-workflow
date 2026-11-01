-- Student portal: level of study and project type; year of study becomes optional.
-- Run after 004_titles_open_to_all_courses.sql.

alter table public.student_profiles alter column year_of_study drop not null;

alter table public.student_profiles add column if not exists study_level text;
alter table public.student_profiles add column if not exists study_level_other text;
alter table public.student_profiles add column if not exists project_category text;

alter table public.student_profiles drop constraint if exists student_profiles_study_level_check;
alter table public.student_profiles add constraint student_profiles_study_level_check
  check (study_level is null or study_level in ('ordinary_diploma', 'bachelor', 'masters', 'other'));

alter table public.student_profiles drop constraint if exists student_profiles_project_category_check;
alter table public.student_profiles add constraint student_profiles_project_category_check
  check (project_category is null or project_category in ('fyp', 'research', 'innovation'));

comment on column public.student_profiles.study_level is 'ordinary_diploma, bachelor, masters or other.';
comment on column public.student_profiles.study_level_other is 'Level typed by the student when study_level = other.';
comment on column public.student_profiles.project_category is 'fyp, research or innovation.';

-- Profiles saved with the old "Year N (NTA Level 7/8)" options were bachelor final year projects.
update public.student_profiles
set
  study_level = coalesce(study_level, case when year_of_study ~ 'NTA Level [78]' then 'bachelor' end),
  project_category = coalesce(project_category, 'fyp'),
  year_of_study = nullif(trim(regexp_replace(year_of_study, '\s*\(NTA Level \d+\)\s*$', '')), '');
