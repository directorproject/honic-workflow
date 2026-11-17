-- Zimamoto: student forum, groups, shared papers, and private group document libraries.

create table if not exists public.zimamoto_groups (
  id uuid primary key default gen_random_uuid (),
  public_id text not null unique,
  name text not null,
  description text not null default '',
  is_private boolean not null default true,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now ()
);

create index if not exists zimamoto_groups_owner_idx on public.zimamoto_groups (owner_user_id, created_at desc);

create table if not exists public.zimamoto_group_members (
  group_id uuid not null references public.zimamoto_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now (),
  primary key (group_id, user_id)
);

create index if not exists zimamoto_group_members_user_idx on public.zimamoto_group_members (user_id, joined_at desc);

create table if not exists public.zimamoto_posts (
  id uuid primary key default gen_random_uuid (),
  public_id text not null unique,
  author_user_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid references public.zimamoto_groups (id) on delete cascade,
  title text not null,
  body text not null default '',
  paper_file_name text,
  paper_storage_path text,
  paper_size_bytes bigint,
  paper_mime_type text,
  created_at timestamptz not null default now ()
);

create index if not exists zimamoto_posts_public_idx on public.zimamoto_posts (created_at desc) where group_id is null;
create index if not exists zimamoto_posts_group_idx on public.zimamoto_posts (group_id, created_at desc);

create table if not exists public.zimamoto_docs (
  id uuid primary key default gen_random_uuid (),
  public_id text not null unique,
  group_id uuid not null references public.zimamoto_groups (id) on delete cascade,
  uploader_user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  notes text not null default '',
  storage_path text not null,
  file_name text not null,
  size_bytes bigint not null default 0,
  mime_type text,
  created_at timestamptz not null default now ()
);

create index if not exists zimamoto_docs_group_idx on public.zimamoto_docs (group_id, created_at desc);

comment on table public.zimamoto_groups is
  'Zimamoto study groups — private by default; members share papers and a saved document library.';
comment on table public.zimamoto_posts is
  'Forum posts and shared papers. group_id null = public Zimamoto board.';
comment on table public.zimamoto_docs is
  'Private group document vault; only members can list and download.';

alter table public.zimamoto_groups enable row level security;
alter table public.zimamoto_group_members enable row level security;
alter table public.zimamoto_posts enable row level security;
alter table public.zimamoto_docs enable row level security;