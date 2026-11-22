-- Allow peer-help offers/escrow from TSh 200 (test floor).

alter table public.portal_job_escrows
  drop constraint if exists portal_job_escrows_amount_tsh_check;

alter table public.portal_job_escrows
  add constraint portal_job_escrows_amount_tsh_check check (amount_tsh >= 200);

alter table public.portal_job_payouts
  drop constraint if exists portal_job_payouts_amount_tsh_check;

alter table public.portal_job_payouts
  add constraint portal_job_payouts_amount_tsh_check check (amount_tsh >= 200);
