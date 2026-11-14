-- Dashboard baseline for the dedicated Supabase project (fpzpcsiczzmwppgmoeem).
-- Generated from the live tables in the old shared project on 1 Nov 2026.
-- Excludes the shop tables, invoices, and the unused sample clients/projects tables.

create extension if not exists pgcrypto;

create table if not exists public.registered_clients (
  id uuid default gen_random_uuid() not null,
  name text not null,
  first_seen_at timestamp with time zone default now() not null,
  last_seen_at timestamp with time zone default now() not null,
  share_subdomain text,
  phone text,
  is_hidden boolean default false not null,
  hidden_at timestamp with time zone,
  is_blocked boolean default false not null,
  blocked_at timestamp with time zone,
  blocked_reason text,
  constraint registered_clients_name_uk UNIQUE (name),
  constraint registered_clients_pkey PRIMARY KEY (id),
  constraint registered_clients_share_subdomain_chk CHECK (((share_subdomain IS NULL) OR (((length(share_subdomain) >= 3) AND (length(share_subdomain) <= 63)) AND (share_subdomain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'::text))))
);

create table if not exists public.tracked_projects (
  id uuid default gen_random_uuid() not null,
  registered_client_id uuid not null,
  title text not null,
  description text,
  project_type text default 'product_prototype'::text not null,
  status text default 'planning'::text not null,
  priority text default 'medium'::text not null,
  start_date date,
  target_end_date date,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  workflow_checklist jsonb default '{}'::jsonb not null,
  google_drive_folder_id text,
  share_research_notes text,
  share_research_links jsonb default '[]'::jsonb not null,
  constraint tracked_projects_pkey PRIMARY KEY (id),
  constraint tracked_projects_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
  constraint tracked_projects_project_type_check CHECK ((project_type = ANY (ARRAY['student_fyp'::text, 'research'::text, 'product_prototype'::text, 'product'::text, 'mvp'::text, 'other'::text]))),
  constraint tracked_projects_status_check CHECK ((status = ANY (ARRAY['planning'::text, 'active'::text, 'prototype_phase'::text, 'testing'::text, 'on_hold'::text, 'client_side'::text, 'completed'::text])))
);

create table if not exists public.project_milestones (
  id uuid default gen_random_uuid() not null,
  tracked_project_id uuid not null,
  title text not null,
  target_date date,
  sort_order integer default 0 not null,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  assignee text,
  work_status text default 'pending'::text not null,
  constraint project_milestones_pkey PRIMARY KEY (id),
  constraint project_milestones_work_status_check CHECK ((work_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'blocked'::text, 'done'::text])))
);

create table if not exists public.project_tasks (
  id uuid default gen_random_uuid() not null,
  tracked_project_id uuid not null,
  milestone_id uuid,
  title text not null,
  status text default 'todo'::text not null,
  assignee text,
  due_date date,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint project_tasks_pkey PRIMARY KEY (id),
  constraint project_tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'blocked'::text, 'done'::text])))
);

create table if not exists public.project_share_links (
  id uuid default gen_random_uuid() not null,
  tracked_project_id uuid not null,
  token text not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone,
  label text,
  constraint project_share_links_pkey PRIMARY KEY (id),
  constraint project_share_links_token_len CHECK ((char_length(token) >= 32)),
  constraint project_share_links_token_unique UNIQUE (token)
);

create table if not exists public.project_share_push_subscriptions (
  id uuid default gen_random_uuid() not null,
  tracked_project_id uuid not null,
  share_token text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint project_share_push_subscription_tracked_project_id_endpoint_key UNIQUE (tracked_project_id, endpoint),
  constraint project_share_push_subscriptions_pkey PRIMARY KEY (id)
);

create table if not exists public.last_year_projects (
  id uuid default gen_random_uuid() not null,
  seed_key text,
  programme text not null,
  source text not null,
  panel text,
  serial_no integer,
  reg_no text,
  student_name text,
  title text not null,
  supervisor text,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint last_year_projects_pkey PRIMARY KEY (id),
  constraint last_year_projects_programme_check CHECK ((programme = ANY (ARRAY['ETE'::text, 'COE'::text]))),
  constraint last_year_projects_seed_key_key UNIQUE (seed_key)
);

create table if not exists public.title_proposals (
  id uuid default gen_random_uuid() not null,
  seed_key text,
  batch text,
  origin_ref text,
  original_title text,
  title text not null,
  summary text,
  hardware text,
  communication text,
  status text default 'available'::text not null,
  assigned_to text,
  assigned_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint title_proposals_pkey PRIMARY KEY (id),
  constraint title_proposals_seed_key_key UNIQUE (seed_key),
  constraint title_proposals_status_check CHECK ((status = ANY (ARRAY['available'::text, 'reserved'::text, 'assigned'::text, 'dropped'::text])))
);

alter table public.project_milestones add constraint project_milestones_tracked_project_id_fkey FOREIGN KEY (tracked_project_id) REFERENCES tracked_projects(id) ON DELETE CASCADE;
alter table public.project_share_links add constraint project_share_links_tracked_project_id_fkey FOREIGN KEY (tracked_project_id) REFERENCES tracked_projects(id) ON DELETE CASCADE;
alter table public.project_share_push_subscriptions add constraint project_share_push_subscriptions_share_token_fkey FOREIGN KEY (share_token) REFERENCES project_share_links(token) ON DELETE CASCADE;
alter table public.project_share_push_subscriptions add constraint project_share_push_subscriptions_tracked_project_id_fkey FOREIGN KEY (tracked_project_id) REFERENCES tracked_projects(id) ON DELETE CASCADE;
alter table public.project_tasks add constraint project_tasks_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES project_milestones(id) ON DELETE SET NULL;
alter table public.project_tasks add constraint project_tasks_tracked_project_id_fkey FOREIGN KEY (tracked_project_id) REFERENCES tracked_projects(id) ON DELETE CASCADE;
alter table public.tracked_projects add constraint tracked_projects_registered_client_id_fkey FOREIGN KEY (registered_client_id) REFERENCES registered_clients(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS last_year_projects_programme_idx ON public.last_year_projects USING btree (programme, panel, serial_no);
CREATE INDEX IF NOT EXISTS project_milestones_project_idx ON public.project_milestones USING btree (tracked_project_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS project_share_links_tracked_project_id_key ON public.project_share_links USING btree (tracked_project_id);
CREATE INDEX IF NOT EXISTS project_share_links_token_idx ON public.project_share_links USING btree (token);
CREATE INDEX IF NOT EXISTS project_share_links_project_idx ON public.project_share_links USING btree (tracked_project_id);
CREATE INDEX IF NOT EXISTS idx_project_share_push_subscriptions_project_id ON public.project_share_push_subscriptions USING btree (tracked_project_id);
CREATE INDEX IF NOT EXISTS idx_project_share_push_subscriptions_share_token ON public.project_share_push_subscriptions USING btree (share_token);
CREATE INDEX IF NOT EXISTS project_tasks_project_idx ON public.project_tasks USING btree (tracked_project_id, sort_order);
CREATE INDEX IF NOT EXISTS project_tasks_open_idx ON public.project_tasks USING btree (tracked_project_id) WHERE (status <> 'done'::text);
CREATE INDEX IF NOT EXISTS registered_clients_visible_idx ON public.registered_clients USING btree (is_hidden, is_blocked, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS registered_clients_last_seen_idx ON public.registered_clients USING btree (last_seen_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS registered_clients_share_subdomain_lower_uk ON public.registered_clients USING btree (lower(share_subdomain)) WHERE ((share_subdomain IS NOT NULL) AND (length(TRIM(BOTH FROM share_subdomain)) > 0));
CREATE INDEX IF NOT EXISTS title_proposals_status_idx ON public.title_proposals USING btree (status, created_at);
CREATE INDEX IF NOT EXISTS tracked_projects_client_idx ON public.tracked_projects USING btree (registered_client_id);
CREATE INDEX IF NOT EXISTS tracked_projects_status_idx ON public.tracked_projects USING btree (status);
CREATE INDEX IF NOT EXISTS tracked_projects_updated_idx ON public.tracked_projects USING btree (updated_at DESC);

comment on column public.project_milestones.assignee is 'Name of the person responsible for this milestone.';
comment on column public.project_milestones.work_status is 'Lifecycle for plans board; done sets completed_at; reopen clears completed_at.';
comment on column public.registered_clients.share_subdomain is 'Optional hostname label (e.g. acme-labs). Must be unique when set. Lowercase a-z, 0-9, hyphen; max 63 chars.';
comment on column public.registered_clients.phone is 'Optional phone; shown on /projects/[id] and /work; not selected on public share pages.';
comment on column public.registered_clients.is_hidden is 'When true, hide client from normal dashboard and new-project selectors.';
comment on column public.registered_clients.is_blocked is 'When true, block client from normal dashboard and new-project selectors.';
comment on column public.registered_clients.blocked_reason is 'Optional operator note explaining why the client is blocked.';
comment on column public.title_proposals.status is 'available: open for selection. reserved: held for someone. assigned: given to a student/team. dropped: no longer offered.';
comment on column public.tracked_projects.status is 'client_side: our pipeline through Full project test is done; client check / handoff pending. completed: 100% weighted pipeline.';
comment on column public.tracked_projects.workflow_checklist is 'Per-step workflow: schematic → … → give_to_client. JSON keys match workflow-checklist.ts';
comment on column public.tracked_projects.google_drive_folder_id is 'Drive folder ID for this project files (child of env-linked folder, or validated descendant).';
comment on column public.tracked_projects.share_research_notes is 'Free text shown on share link: context and document notes from internal research.';
comment on column public.tracked_projects.share_research_links is 'JSON array of { "label": string, "url": string } shown as links on the share page.';
comment on table public.project_share_links is 'One unlisted client URL per project: /share/{client-slug}/{token} (+ legacy /share/{token} redirects).';

-- Locked down: the app reads and writes only with the service role (server side), so no
-- anon or authenticated policies are created. Shop customers and students cannot reach these tables.
alter table public.registered_clients enable row level security;
alter table public.tracked_projects enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_share_links enable row level security;
alter table public.project_share_push_subscriptions enable row level security;
alter table public.last_year_projects enable row level security;
alter table public.title_proposals enable row level security;

-- Client list for the dashboard (unchanged from the old project).
create or replace function public.get_registered_clients_for_dashboard()
returns table(id uuid, name text, first_seen_at timestamptz, last_seen_at timestamptz, phone text,
              is_hidden boolean, is_blocked boolean, blocked_reason text)
language sql stable set search_path to 'public'
as $$
  select r.id, r.name, r.first_seen_at, r.last_seen_at, r.phone, r.is_hidden, r.is_blocked, r.blocked_reason
  from public.registered_clients r
  where coalesce(r.is_hidden, false) = false and coalesce(r.is_blocked, false) = false
  order by r.last_seen_at desc;
$$;
revoke execute on function public.get_registered_clients_for_dashboard() from public, anon, authenticated;
grant execute on function public.get_registered_clients_for_dashboard() to service_role;

-- Invoices live in the shop project, so the app checks them before calling this.
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
  delete from public.registered_clients where id = p_client_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.delete_registered_client(uuid) from public, anon, authenticated;
grant execute on function public.delete_registered_client(uuid) to service_role;
