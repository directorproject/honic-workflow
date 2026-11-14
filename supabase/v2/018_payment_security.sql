-- Financial security: webhook dedup, unique provider refs, audit columns.

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid (),
  provider text not null default 'snippe',
  event_id text not null,
  event_type text,
  payment_reference text,
  order_id text,
  amount_tsh integer,
  currency text,
  signature_ok boolean not null default true,
  outcome text not null default 'accepted',
  created_at timestamptz not null default now (),
  constraint payment_webhook_events_provider_event unique (provider, event_id)
);

create index if not exists payment_webhook_events_created_idx
  on public.payment_webhook_events (created_at desc);

create index if not exists payment_webhook_events_order_idx
  on public.payment_webhook_events (order_id)
  where order_id is not null;

comment on table public.payment_webhook_events is
  'Idempotent Snippe (and future) webhook receipts — blocks replay / double fulfill.';

alter table public.title_change_payments
  add column if not exists webhook_event_id text;

create unique index if not exists title_change_payments_provider_txn_uidx
  on public.title_change_payments (provider_txn_id)
  where provider_txn_id is not null;

alter table public.portal_invoices
  add column if not exists provider_txn_id text,
  add column if not exists webhook_event_id text;

create unique index if not exists portal_invoices_provider_txn_uidx
  on public.portal_invoices (provider_txn_id)
  where provider_txn_id is not null;

comment on column public.title_change_payments.provider is
  'snippe (live USSD push) or simulated (dev only).';

comment on column public.title_change_payments.selection_id is
  'title_selections.id to release after Snippe confirms payment.';

-- One open pending payment per selection (stops parallel double-charge attempts).
create unique index if not exists title_change_payments_pending_selection_uidx
  on public.title_change_payments (selection_id)
  where status = 'pending' and selection_id is not null;

alter table public.payment_webhook_events enable row level security;
