-- Document access tracking and limits by plan
-- Tracks which documents users can access and download based on their plan

create table if not exists public.document_access_limits (
  plan_id text primary key,
  view_count int not null default 0,
  download_count int not null default 0,
  can_print boolean not null default false,
  can_screenshot boolean not null default false,
  created_at timestamp with time zone default now()
);

comment on table public.document_access_limits is 'Document access limits per plan tier';

insert into public.document_access_limits (plan_id, view_count, download_count, can_print, can_screenshot)
values
  ('free', 999, 0, false, false),
  ('monthly', 1, 1, false, false),
  ('semester', 3, 3, false, false),
  ('year', 5, 5, false, false)
on conflict (plan_id) do update set
  view_count = excluded.view_count,
  download_count = excluded.download_count,
  can_print = excluded.can_print,
  can_screenshot = excluded.can_screenshot;

-- Track user document access
create table if not exists public.user_document_access (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  document_id text not null,
  accessed_at timestamp with time zone default now(),
  downloaded_at timestamp with time zone,
  view_count int default 1,
  download_count int default 0,
  created_at timestamp with time zone default now()
);

comment on table public.user_document_access is 'Track when users access and download documents';

create index if not exists idx_user_document_access_user_id on public.user_document_access(user_id);
create index if not exists idx_user_document_access_document_id on public.user_document_access(document_id);
create index if not exists idx_user_document_access_accessed_at on public.user_document_access(accessed_at);

-- RLS policies
alter table public.document_access_limits enable row level security;
alter table public.user_document_access enable row level security;

create policy "Anyone can view document access limits"
  on public.document_access_limits
  for select
  to authenticated
  using (true);

create policy "Users can only see their own document access"
  on public.user_document_access
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can only insert their own document access"
  on public.user_document_access
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can only update their own document access"
  on public.user_document_access
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
