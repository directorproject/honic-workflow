-- Anonymous job board: post work offers, apply, negotiate in-app (no real names).

create table if not exists public.portal_jobs (
  id uuid primary key default gen_random_uuid (),
  public_id text not null unique,
  poster_user_id uuid not null references auth.users (id) on delete cascade,
  poster_public_id text not null,
  category text not null,
  title text not null,
  description text not null,
  offer_tsh integer not null check (offer_tsh > 0),
  price_mode text not null default 'fixed' check (price_mode in ('fixed', 'negotiable')),
  status text not null default 'open' check (status in ('open', 'assigned', 'closed', 'cancelled')),
  assigned_application_id uuid,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now ()
);

create index if not exists portal_jobs_status_created_idx
  on public.portal_jobs (status, created_at desc);

create index if not exists portal_jobs_poster_idx
  on public.portal_jobs (poster_user_id, created_at desc);

create index if not exists portal_jobs_category_idx
  on public.portal_jobs (category, status);

create table if not exists public.portal_job_applications (
  id uuid primary key default gen_random_uuid (),
  public_id text not null unique,
  job_id uuid not null references public.portal_jobs (id) on delete cascade,
  applicant_user_id uuid not null references auth.users (id) on delete cascade,
  applicant_public_id text not null,
  message text not null,
  proposed_tsh integer check (proposed_tsh is null or proposed_tsh > 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint portal_job_applications_unique_applicant unique (job_id, applicant_user_id)
);

create index if not exists portal_job_applications_job_idx
  on public.portal_job_applications (job_id, created_at desc);

create index if not exists portal_job_applications_applicant_idx
  on public.portal_job_applications (applicant_user_id, created_at desc);

create table if not exists public.portal_job_messages (
  id uuid primary key default gen_random_uuid (),
  application_id uuid not null references public.portal_job_applications (id) on delete cascade,
  sender_user_id uuid not null references auth.users (id) on delete cascade,
  sender_public_id text not null,
  body text not null,
  created_at timestamptz not null default now ()
);

create index if not exists portal_job_messages_app_idx
  on public.portal_job_messages (application_id, created_at asc);

comment on table public.portal_jobs is
  'Anonymous student job posts (documents, PPT, circuits, diagrams). Show public IDs only, never real names.';

comment on column public.portal_jobs.price_mode is
  'fixed = take the listed offer; negotiable = applicants may propose and discuss price in-app.';

alter table public.portal_jobs enable row level security;
alter table public.portal_job_applications enable row level security;
alter table public.portal_job_messages enable row level security;
