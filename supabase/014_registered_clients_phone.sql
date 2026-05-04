-- Optional contact phone (dashboard project view/manage only; share routes omit this field in queries).

alter table public.registered_clients add column if not exists phone text;

comment on column public.registered_clients.phone is 'Optional phone; shown on /projects/[id] and /work; not selected on public share pages.';

-- Keep dashboard RPC aligned with table columns.
create or replace function public.get_registered_clients_for_dashboard ()
returns table (
  id uuid,
  name text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  phone text
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
    r.phone
  from public.registered_clients r
  order by r.last_seen_at desc;
$$;
