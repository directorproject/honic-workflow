-- Zimamoto group chat: messages and shared files kept in the group history.
-- Files stay in storage until the group is deleted (no auto-expiry).

create table if not exists public.zimamoto_messages (
  id uuid primary key default gen_random_uuid (),
  group_id uuid not null references public.zimamoto_groups (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete cascade,
  body text not null default '',
  file_name text,
  storage_path text,
  size_bytes bigint,
  mime_type text,
  created_at timestamptz not null default now (),
  constraint zimamoto_messages_has_content check (length(body) > 0 or storage_path is not null),
  constraint zimamoto_messages_body_len check (length(body) <= 4000)
);

create index if not exists zimamoto_messages_group_idx on public.zimamoto_messages (group_id, created_at desc);
create index if not exists zimamoto_messages_files_idx on public.zimamoto_messages (group_id, created_at desc)
  where storage_path is not null;

comment on table public.zimamoto_messages is
  'Zimamoto group chat. Members read via Realtime; the app writes through the server (service role).';

alter table public.zimamoto_messages enable row level security;

-- Members may read their group's messages. Realtime uses the signed-in user's JWT, so this
-- policy is what lets live updates reach members and nobody else.
create or replace function public.zimamoto_is_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.zimamoto_group_members m
    where m.group_id = gid and m.user_id = auth.uid()
  );
$$;

revoke all on function public.zimamoto_is_member(uuid) from public;
grant execute on function public.zimamoto_is_member(uuid) to authenticated;

drop policy if exists zimamoto_messages_member_select on public.zimamoto_messages;
create policy zimamoto_messages_member_select on public.zimamoto_messages
  for select to authenticated
  using (public.zimamoto_is_member(group_id));

-- Live delivery of new messages to group members.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'zimamoto_messages'
  ) then
    alter publication supabase_realtime add table public.zimamoto_messages;
  end if;
end $$;
