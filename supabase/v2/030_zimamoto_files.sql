-- Zimamoto file organisation: folders, pins, and soft delete for chat files and library documents.
-- Deleted files are hidden (not erased) so group history stays intact.

create table if not exists public.zimamoto_folders (
  id uuid primary key default gen_random_uuid (),
  group_id uuid not null references public.zimamoto_groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now (),
  unique (group_id, name)
);

comment on table public.zimamoto_folders is 'Topic folders for a Zimamoto group file library.';

alter table public.zimamoto_folders enable row level security;

drop policy if exists zimamoto_folders_member_select on public.zimamoto_folders;
create policy zimamoto_folders_member_select on public.zimamoto_folders
  for select to authenticated
  using (public.zimamoto_is_member(group_id));

alter table public.zimamoto_messages
  add column if not exists folder_id uuid references public.zimamoto_folders (id) on delete set null,
  add column if not exists pinned boolean not null default false,
  add column if not exists deleted_at timestamptz;

alter table public.zimamoto_docs
  add column if not exists folder_id uuid references public.zimamoto_folders (id) on delete set null,
  add column if not exists pinned boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists zimamoto_messages_folder_idx on public.zimamoto_messages (folder_id) where folder_id is not null;
create index if not exists zimamoto_docs_folder_idx on public.zimamoto_docs (folder_id) where folder_id is not null;
