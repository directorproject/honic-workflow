-- Invoice edit: renaming client_name should update registered_clients, not add a duplicate.
-- Run after 005_registered_clients_sync.sql (and 006 if you use tracked_projects).

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

        delete from public.registered_clients r
        where r.id = v_old_id
          and (
            to_regclass('public.tracked_projects') is null
            or not exists (
              select 1
              from public.tracked_projects p
              where p.registered_client_id = r.id
            )
          );
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
