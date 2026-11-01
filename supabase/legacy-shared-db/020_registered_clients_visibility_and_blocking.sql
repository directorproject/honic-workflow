-- Manage registered clients with hide/block states.
-- Hidden/blocked clients are excluded from default dashboard/project pickers.

alter table public.registered_clients
  add column if not exists is_hidden boolean not null default false,
  add column if not exists hidden_at timestamptz null,
  add column if not exists is_blocked boolean not null default false,
  add column if not exists blocked_at timestamptz null,
  add column if not exists blocked_reason text null;

create index if not exists registered_clients_visible_idx
  on public.registered_clients (is_hidden, is_blocked, last_seen_at desc);

comment on column public.registered_clients.is_hidden is
  'When true, hide client from normal dashboard and new-project selectors.';
comment on column public.registered_clients.is_blocked is
  'When true, block client from normal dashboard and new-project selectors.';
comment on column public.registered_clients.blocked_reason is
  'Optional operator note explaining why the client is blocked.';

drop function if exists public.get_registered_clients_for_dashboard ();

create function public.get_registered_clients_for_dashboard ()
returns table (
  id uuid,
  name text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  phone text,
  is_hidden boolean,
  is_blocked boolean,
  blocked_reason text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.id,
    r.name,
    r.first_seen_at,
    r.last_seen_at,
    r.phone,
    r.is_hidden,
    r.is_blocked,
    r.blocked_reason
  from public.registered_clients r
  where coalesce(r.is_hidden, false) = false
    and coalesce(r.is_blocked, false) = false
  order by r.last_seen_at desc;
$$;

grant execute on function public.get_registered_clients_for_dashboard () to anon, authenticated;
