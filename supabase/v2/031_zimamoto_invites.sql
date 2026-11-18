-- Zimamoto access control: public groups are open to anyone; private groups join only by an
-- invitation the group owner (admin) creates. Invitations expire, can be limited, and can be revoked.

create table if not exists public.zimamoto_invites (
  id uuid primary key default gen_random_uuid (),
  group_id uuid not null references public.zimamoto_groups (id) on delete cascade,
  code text not null unique check (char_length(code) between 16 and 64),
  created_by uuid not null references auth.users (id) on delete cascade,
  max_uses integer not null default 25 check (max_uses between 1 and 500),
  uses integer not null default 0,
  expires_at timestamptz not null default (now() + interval '14 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now ()
);

create index if not exists zimamoto_invites_group_idx on public.zimamoto_invites (group_id, created_at desc);

comment on table public.zimamoto_invites is
  'Invitation codes for private Zimamoto groups. Created and revoked by the group owner; read by the server only.';

alter table public.zimamoto_invites enable row level security;
-- No client policies: the app reads and writes invitations on the server only.
