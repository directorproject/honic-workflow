-- Drop registered_clients when the last invoice for that name is deleted (or via RPC).
-- Keeps rows that still have invoices or tracked_projects.
-- Run after 005 / 015. Recreates invoice sync trigger to include DELETE.

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
execute function public.tg_invoices_sync_registered_client ();

-- Manual delete from dashboard / API (same rules as prune).
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

grant execute on function public.prune_registered_client_by_name(text) to service_role;
grant execute on function public.delete_registered_client(uuid) to anon, authenticated, service_role;
