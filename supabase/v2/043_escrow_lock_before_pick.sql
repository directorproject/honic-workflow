-- Peer-help: poster can lock money first, then pick a helper with one tap.
-- New status 'funded' = money held by Honic, no helper picked yet.
-- Helper / offer columns stay empty until the poster picks.

alter table public.portal_job_escrows
  alter column application_id drop not null,
  alter column helper_user_id drop not null;

alter table public.portal_job_escrows
  drop constraint if exists portal_job_escrows_status_check;

alter table public.portal_job_escrows
  add constraint portal_job_escrows_status_check check (status in (
    'awaiting_funds',
    'funded',
    'locked',
    'delivered',
    'disputed',
    'released',
    'refunded',
    'cancelled'
  ));

-- A picked escrow (locked and later) must name its helper.
alter table public.portal_job_escrows
  drop constraint if exists portal_job_escrows_helper_when_picked;

alter table public.portal_job_escrows
  add constraint portal_job_escrows_helper_when_picked check (
    status in ('awaiting_funds', 'funded', 'cancelled', 'refunded')
    or (application_id is not null and helper_user_id is not null)
  );
