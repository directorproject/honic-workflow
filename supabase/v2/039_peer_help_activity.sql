-- Peer-help: delivery deadline (auto-refund), revision loop, shared activity log.

alter table public.portal_job_escrows
  add column if not exists delivery_deadline_at timestamptz,
  add column if not exists revision_note text,
  add column if not exists revision_requested_at timestamptz,
  add column if not exists revision_count integer not null default 0;

create index if not exists portal_job_escrows_delivery_deadline_idx
  on public.portal_job_escrows (status, delivery_deadline_at)
  where status = 'locked';

create table if not exists public.portal_job_escrow_events (
  id uuid primary key default gen_random_uuid (),
  public_id text not null unique,
  escrow_id uuid not null references public.portal_job_escrows (id) on delete cascade,
  event_type text not null,
  actor_role text not null default 'system'
    check (actor_role in ('poster', 'helper', 'staff', 'system')),
  message text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now ()
);

create index if not exists portal_job_escrow_events_escrow_idx
  on public.portal_job_escrow_events (escrow_id, created_at desc);
