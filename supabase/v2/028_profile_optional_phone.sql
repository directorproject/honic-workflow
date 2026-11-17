-- Phone is collected when paying; students may skip it on first sign-up.
alter table public.student_profiles alter column phone drop not null;

comment on column public.student_profiles.phone is
  'Mobile money number. Optional until the student pays or updates their account.';