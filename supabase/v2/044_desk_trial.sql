-- One-time 14-day free Nexis Desk trial (monthly plan limits) for registered students.

alter table public.student_profiles
  add column if not exists desk_trial_started_at timestamptz;

comment on column public.student_profiles.desk_trial_started_at is
  'When the one-time 14-day free desk trial started. Null = never used. During trial desk_plan is trial and desk_expires_at ends access.';

comment on column public.student_profiles.desk_plan is
  'Active membership product id (trial | monthly | semester | year) when desk_expires_at is in the future.';
