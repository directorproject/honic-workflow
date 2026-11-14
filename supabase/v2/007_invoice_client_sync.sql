-- New project invoices add a registered client. Shop sales do not. A name an admin deletes stays deleted.

create table if not exists public.registered_client_removals (
  name text primary key,
  removed_at timestamptz not null default now()
);

create table if not exists public.invoice_client_entries (
  shop_invoice_id uuid primary key,
  client_name text not null,
  title text,
  issued_at timestamptz not null
);

create table if not exists public.invoice_sync_state (
  id text primary key,
  watermark timestamptz not null
);

insert into public.invoice_sync_state (id, watermark)
values ('shop_invoices', '2026-11-01T00:00:00+03:00')
on conflict (id) do nothing;

alter table public.registered_client_removals enable row level security;
alter table public.invoice_client_entries enable row level security;
alter table public.invoice_sync_state enable row level security;

comment on table public.registered_client_removals is
  'Client names an admin removed. A later invoice must not add these names again.';
comment on table public.invoice_client_entries is
  'One row per shop invoice that registered a client, with the title from that invoice.';

create or replace function public.delete_registered_client(p_client_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_name text;
  v_projects int;
begin
  if p_client_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_id');
  end if;
  select r.name into v_name from public.registered_clients r where r.id = p_client_id;
  if v_name is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select count(*)::int into v_projects from public.tracked_projects p where p.registered_client_id = p_client_id;
  if v_projects > 0 then
    return jsonb_build_object('ok', false, 'error', 'has_projects', 'project_count', v_projects);
  end if;
  insert into public.registered_client_removals (name)
  values (v_name)
  on conflict (name) do update set removed_at = now();
  delete from public.registered_clients where id = p_client_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.delete_registered_client(uuid) from public, anon, authenticated;
grant execute on function public.delete_registered_client(uuid) to service_role;
