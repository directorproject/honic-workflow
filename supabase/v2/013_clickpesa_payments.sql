-- ClickPesa: track which title slot a pending payment will release.
alter table public.title_change_payments
  add column if not exists selection_id uuid,
  add column if not exists provider_txn_id text;

comment on column public.title_change_payments.provider is
  'clickpesa (live USSD push) or simulated (dev only).';

comment on column public.title_change_payments.selection_id is
  'title_selections.id to release after ClickPesa confirms payment.';
