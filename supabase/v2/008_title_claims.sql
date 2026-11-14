-- Strong public ids for every title, plus claims and new projects that stay hidden until staff confirm them.
-- Confirmed owners may publish documents. Those documents are shown when someone opens the title.
-- Same access model as the other portal tables: RLS on, no anon or authenticated policies. The app uses the service role.

alter table public.title_proposals add column if not exists public_id text;
alter table public.last_year_projects add column if not exists public_id text;

update public.title_proposals
set public_id = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where public_id is null or length(public_id) < 32;

update public.last_year_projects
set public_id = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where public_id is null or length(public_id) < 32;

alter table public.title_proposals
  alter column public_id set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  alter column public_id set not null;

alter table public.last_year_projects
  alter column public_id set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  alter column public_id set not null;

create unique index if not exists title_proposals_public_id_uk on public.title_proposals (public_id);
create unique index if not exists last_year_projects_public_id_uk on public.last_year_projects (public_id);

create table if not exists public.portal_title_claims (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  requester_id uuid not null references auth.users (id) on delete cascade,
  request_kind text not null check (request_kind in ('claim', 'new')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  target_kind text check (target_kind is null or target_kind in ('proposal', 'earlier')),
  target_id uuid,
  title text not null,
  explanation text,
  course_code text,
  institution text,
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint portal_title_claims_target check (
    (request_kind = 'claim' and target_kind is not null and target_id is not null)
    or (request_kind = 'new' and status <> 'confirmed' and target_id is null)
    or (request_kind = 'new' and status = 'confirmed' and target_kind = 'proposal' and target_id is not null)
  )
);

create unique index if not exists portal_title_claims_one_confirmed
  on public.portal_title_claims (target_kind, target_id)
  where status = 'confirmed' and target_id is not null;

create unique index if not exists portal_title_claims_one_pending
  on public.portal_title_claims (requester_id, target_kind, target_id)
  where status = 'pending' and target_id is not null;

create index if not exists portal_title_claims_user_idx on public.portal_title_claims (requester_id, created_at desc);
create index if not exists portal_title_claims_status_idx on public.portal_title_claims (status, created_at desc);

create table if not exists public.portal_title_documents (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  claim_id uuid not null references public.portal_title_claims (id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  size_bytes bigint not null default 0,
  mime_type text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists portal_title_documents_claim_idx on public.portal_title_documents (claim_id, created_at desc);

alter table public.portal_title_claims enable row level security;
alter table public.portal_title_documents enable row level security;

comment on table public.portal_title_claims is
  'A student claim that an existing title is theirs, or a new project they posted. Hidden from the catalogue until staff set status to confirmed.';
comment on table public.portal_title_documents is
  'Documents published by the confirmed owner. Shown when someone opens that title.';
