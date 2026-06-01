-- Registered client names: mirrored from invoices.client_name via trigger + optional backfill.
-- Run after `public.invoices` exists.
--
-- Flow: INSERT/UPDATE on invoices → upsert trimmed name into registered_clients.
-- Dashboard reads registered_clients (not invoices directly).

create table if not exists public.registered_clients (
  id uuid primary key default gen_random_uuid (),
  name text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint registered_clients_name_uk unique (name)
);

create index if not exists registered_clients_last_seen_idx
  on public.registered_clients using btree (last_seen_at desc);

-- Remove registry row when no invoices use the name and no tracked_projects reference it.
create or replace function public.prune_registered_client_by_name(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n text;
  v_id uuid;
begin
  n := trim(coalesce(p_name, ''));
  if length(n) = 0 then
    return;
  end if;

  if exists (
    select 1
    from public.invoices i
    where trim(coalesce(i.client_name, '')) = n
  ) then
    return;
  end if;

  select r.id into v_id
  from public.registered_clients r
  where r.name = n
  limit 1;

  if v_id is null then
    return;
  end if;

  if to_regclass('public.tracked_projects') is not null
     and exists (
       select 1
       from public.tracked_projects p
       where p.registered_client_id = v_id
     ) then
    return;
  end if;

  delete from public.registered_clients
  where id = v_id;
end;
$$;

-- Runs as definer so inserts succeed even when RLS blocks direct anon INSERT.
create or replace function public.tg_invoices_sync_registered_client ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n text;
  o text;
  v_old_id uuid;
  v_new_id uuid;
begin
  if tg_op = 'DELETE' then
    perform public.prune_registered_client_by_name(old.client_name);
    return old;
  end if;

  n := trim(coalesce(new.client_name, ''));
  o := trim(coalesce(old.client_name, ''));

  if length(n) = 0 then
    return new;
  end if;

  if tg_op = 'UPDATE' and o is not distinct from n then
    return new;
  end if;

  -- Invoice rename: update the same registered_clients row (or merge projects), not a second client.
  if tg_op = 'UPDATE' and length(o) > 0 and o is distinct from n then
    if not exists (
      select 1
      from public.invoices i
      where i.id is distinct from new.id
        and trim(coalesce(i.client_name, '')) = o
    ) then
      select r.id into v_old_id
      from public.registered_clients r
      where r.name = o
      limit 1;

      select r.id into v_new_id
      from public.registered_clients r
      where r.name = n
      limit 1;

      if v_old_id is not null and v_new_id is not null and v_old_id is distinct from v_new_id then
        if to_regclass('public.tracked_projects') is not null then
          update public.tracked_projects p
          set registered_client_id = v_new_id
          where p.registered_client_id = v_old_id;
        end if;

        perform public.prune_registered_client_by_name(o);
      elsif v_old_id is not null and v_new_id is null then
        update public.registered_clients
        set
          name = n,
          last_seen_at = now()
        where id = v_old_id;
      end if;
    end if;
  end if;

  insert into public.registered_clients (name)
  values (n)
  on conflict (name) do update set
    last_seen_at = now();

  return new;
end;
$$;

drop trigger if exists trg_invoices_sync_registered_client on public.invoices;

create trigger trg_invoices_sync_registered_client
after insert
or update of client_name
or delete on public.invoices
for each row
execute procedure public.tg_invoices_sync_registered_client ();

-- One-time merge from existing invoices (safe to re-run).
insert into public.registered_clients (name, first_seen_at, last_seen_at)
select
  trim(i.client_name) as name,
  min(i.created_at) as first_seen_at,
  max(i.updated_at) as last_seen_at
from public.invoices i
where i.client_name is not null
  and trim(i.client_name) <> ''
group by trim(i.client_name)
on conflict (name) do update set
  first_seen_at = least(
    public.registered_clients.first_seen_at,
    excluded.first_seen_at
  ),
  last_seen_at = greatest(
    public.registered_clients.last_seen_at,
    excluded.last_seen_at
  );

-- RLS: dashboard reads; writes happen via trigger (security definer).
alter table public.registered_clients enable row level security;

drop policy if exists "registered_clients_select_dashboard" on public.registered_clients;

create policy "registered_clients_select_dashboard"
on public.registered_clients for select to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;

grant select on table public.registered_clients to anon, authenticated;

-- RPC for PostgREST / Next.js
create or replace function public.get_registered_clients_for_dashboard ()
returns table (
  id uuid,
  name text,
  first_seen_at timestamptz,
  last_seen_at timestamptz
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
    r.last_seen_at
  from public.registered_clients r
  order by r.last_seen_at desc;
$$;

grant execute on function public.get_registered_clients_for_dashboard () to anon, authenticated;

create or replace function public.delete_registered_client(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_projects int;
begin
  if p_client_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_id');
  end if;

  select r.name into v_name
  from public.registered_clients r
  where r.id = p_client_id;

  if v_name is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if exists (
    select 1
    from public.invoices i
    where trim(coalesce(i.client_name, '')) = trim(v_name)
  ) then
    return jsonb_build_object('ok', false, 'error', 'has_invoices');
  end if;

  if to_regclass('public.tracked_projects') is not null then
    select count(*)::int into v_projects
    from public.tracked_projects p
    where p.registered_client_id = p_client_id;

    if v_projects > 0 then
      return jsonb_build_object(
        'ok', false,
        'error', 'has_projects',
        'project_count', v_projects
      );
    end if;
  end if;

  delete from public.registered_clients
  where id = p_client_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.delete_registered_client(uuid) to anon, authenticated, service_role;
