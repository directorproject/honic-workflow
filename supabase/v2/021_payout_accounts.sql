-- Payout accounts for students with confirmed title ownership claims.
-- Account holder name must match the registered student profile name (enforced in app + sealed hash).

alter table public.title_change_payments
  add column if not exists purpose text;

comment on column public.title_change_payments.purpose is
  'membership | title_hide | title_change | other — set at create; UI may also infer from reference prefix.';

create table if not exists public.portal_payout_accounts (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  claim_id uuid references public.portal_title_claims (id) on delete set null,
  network text not null,
  phone text not null,
  account_name text not null,
  registered_name text not null,
  status text not null default 'active' check (status in ('active', 'locked', 'revoked')),
  integrity_hash text not null,
  locked_at timestamptz,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint portal_payout_accounts_user_unique unique (user_id)
);

create index if not exists portal_payout_accounts_user_idx
  on public.portal_payout_accounts (user_id);

create index if not exists portal_payout_accounts_claim_idx
  on public.portal_payout_accounts (claim_id)
  where claim_id is not null;

comment on table public.portal_payout_accounts is
  'Mobile-money payout destination for confirmed title owners. Name must match student_profiles.full_name; changes require Help desk.';

comment on column public.portal_payout_accounts.integrity_hash is
  'sha256 seal of user_id|account_name|phone|network|registered_name — detects tampering.';

alter table public.portal_payout_accounts enable row level security;

-- Students read their own row only (writes go through service role / server actions).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'portal_payout_accounts' and policyname = 'payout_select_own'
  ) then
    create policy payout_select_own on public.portal_payout_accounts
      for select to authenticated
      using (user_id = auth.uid());
  end if;
end $$;
