-- Opaque public ids for registered portal accounts (staff user pages never expose auth.users.id).
-- Also staff audit log for sensitive account / claim actions.
-- RLS on, no anon/authenticated policies — app uses service role only.

create table if not exists public.portal_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  public_id text not null unique
    default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_accounts_public_id_len check (char_length(public_id) = 64)
);

create unique index if not exists portal_accounts_public_id_uk on public.portal_accounts (public_id);

insert into public.portal_accounts (user_id, public_id)
select
  u.id,
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
from auth.users u
where not exists (
  select 1 from public.portal_accounts a where a.user_id = u.id
);

create table if not exists public.portal_staff_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users (id) on delete set null,
  target_public_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists portal_staff_audit_created_idx on public.portal_staff_audit (created_at desc);
create index if not exists portal_staff_audit_target_idx on public.portal_staff_audit (target_public_id);

alter table public.portal_accounts enable row level security;
alter table public.portal_staff_audit enable row level security;
