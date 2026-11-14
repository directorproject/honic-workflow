-- Pending mobile-money prompts expire so students can retry safely.

alter table public.title_change_payments
  add column if not exists expires_at timestamptz;

create index if not exists title_change_payments_pending_expires_idx
  on public.title_change_payments (expires_at)
  where status = 'pending';

comment on column public.title_change_payments.expires_at is
  'When a pending USSD / mobile-money prompt stops being valid. After this, status should be treated as expired/failed.';

-- Backfill open pending rows with a 15-minute window from creation.
update public.title_change_payments
set expires_at = created_at + interval '15 minutes'
where status = 'pending'
  and expires_at is null;
