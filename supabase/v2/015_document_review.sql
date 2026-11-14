-- Review model: share with supervisor, page partials, markup (draw + page/general notes).
-- Supervisor portal: one account (portal_supervisor_profiles) matched by workspace supervisor_email.

alter table public.portal_documents
  add column if not exists shared_with_supervisor boolean not null default false,
  add column if not exists parent_id uuid references public.portal_documents (id) on delete cascade,
  add column if not exists page_from integer,
  add column if not exists page_to integer;

comment on column public.portal_documents.shared_with_supervisor is
  'Student marks this review item visible to the supervisor right now.';
comment on column public.portal_documents.parent_id is
  'When set, this row is a partial (page range) split from the main document.';
comment on column public.portal_documents.page_from is
  'First page of a partial (1-based), inclusive.';
comment on column public.portal_documents.page_to is
  'Last page of a partial (1-based), inclusive.';

create index if not exists portal_documents_shared_idx
  on public.portal_documents (workspace_id, shared_with_supervisor)
  where shared_with_supervisor;

create index if not exists portal_documents_parent_idx
  on public.portal_documents (parent_id)
  where parent_id is not null;

create table if not exists public.portal_review_marks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  document_id uuid not null references public.portal_documents (id) on delete cascade,
  author_kind text not null check (author_kind in ('student', 'staff', 'supervisor')),
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null,
  kind text not null check (kind in ('comment', 'draw', 'general')),
  page_number integer check (page_number is null or page_number >= 1),
  body text,
  strokes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint portal_review_marks_page_ck check (
    (kind = 'general' and page_number is null)
    or (kind in ('comment', 'draw') and page_number is not null)
  )
);

create index if not exists portal_review_marks_doc_idx
  on public.portal_review_marks (document_id, created_at);

create index if not exists portal_review_marks_ws_idx
  on public.portal_review_marks (workspace_id, created_at desc);

alter table public.portal_review_marks enable row level security;

create table if not exists public.portal_supervisor_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_supervisor_profiles_email_ck check (position('@' in email) > 1)
);

create unique index if not exists portal_supervisor_profiles_email_uk
  on public.portal_supervisor_profiles (lower(email));

alter table public.portal_supervisor_profiles enable row level security;
