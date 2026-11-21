-- In-app notifications when someone applies to a peer-help request.

create table if not exists public.portal_job_notifications (
  id uuid primary key default gen_random_uuid (),
  public_id text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.portal_jobs (id) on delete cascade,
  application_id uuid references public.portal_job_applications (id) on delete set null,
  kind text not null default 'application'
    check (kind in ('application', 'message', 'escrow', 'system')),
  title text not null,
  body text not null,
  href text not null,
  read_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default now ()
);

create index if not exists portal_job_notifications_user_unread_idx
  on public.portal_job_notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists portal_job_notifications_user_idx
  on public.portal_job_notifications (user_id, created_at desc);

comment on table public.portal_job_notifications is
  'Student portal alerts for peer help (new offers, etc.). Badge = unread count.';

alter table public.portal_job_notifications enable row level security;
