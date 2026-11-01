-- Student portal profile options: registration number optional, typed-in course, more courses.
-- Run after 002_student_portal.sql.

alter table public.student_profiles alter column reg_no drop not null;
alter table public.student_profiles add column if not exists course_other text;

comment on column public.student_profiles.course_other is
  'Course typed by the student when course_code = OTHER.';

insert into public.courses (code, name, sort_order) values
  ('EE', 'Electrical Engineering', 3),
  ('ME', 'Mechanical Engineering', 4),
  ('CE', 'Civil Engineering', 5),
  ('BME', 'Biomedical Engineering', 6),
  ('MTE', 'Mechatronics Engineering', 7),
  ('REE', 'Renewable Energy Engineering', 8),
  ('CHE', 'Chemical and Process Engineering', 9),
  ('ENV', 'Environmental Engineering', 10),
  ('AGE', 'Agricultural Engineering', 11),
  ('MIN', 'Mining Engineering', 12),
  ('PET', 'Petroleum Engineering', 13),
  ('WRE', 'Water Resources Engineering', 14),
  ('AUE', 'Automotive Engineering', 15),
  ('CS', 'Computer Science', 16),
  ('IT', 'Information Technology', 17),
  ('SE', 'Software Engineering', 18),
  ('CNS', 'Computer Networks and Security', 19),
  ('SLT', 'Science and Laboratory Technology', 20),
  ('FST', 'Food Science and Technology', 21),
  ('MLS', 'Medical Laboratory Sciences', 22),
  ('PHY', 'Physics and Electronics', 23),
  ('OTHER', 'Other (type your course)', 999)
on conflict (code) do nothing;
