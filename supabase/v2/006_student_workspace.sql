-- Student project workspace on share.honiccompany.com/portal: overview, team, plan (phases and tasks),
-- calendar, documents and files, logbook, data, parts, references, messages with Honic, sessions,
-- payments, defence preparation, activity and push subscriptions.
-- Same model as 002: RLS on, no anon/authenticated policies; the app uses the service role on the server.

create table if not exists public.portal_workspaces (
  id uuid primary key default gen_random_uuid (),
  name text not null,
  title_proposal_id uuid references public.title_proposals (id) on delete set null,
  project_category text check (project_category in ('fyp', 'research', 'innovation')),
  problem_statement text,
  objectives text,
  scope text,
  methodology text,
  expected_results text,
  technologies text,
  start_date date,
  end_date date,
  defence_date date,
  supervisor_name text,
  supervisor_email text,
  supervisor_phone text,
  supervisor_meetings text,
  budget_tsh integer check (budget_tsh is null or budget_tsh >= 0),
  supervisor_token text unique,
  supervisor_link_enabled boolean not null default false,
  last_digest_on date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table if not exists public.portal_workspace_members (
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint portal_workspace_members_one_per_user unique (user_id)
);

create table if not exists public.portal_workspace_invites (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  email text not null,
  token text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint portal_workspace_invites_once unique (workspace_id, email)
);

create table if not exists public.portal_phases (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  name text not null,
  color text not null default 'sky',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists portal_phases_ws_idx on public.portal_phases (workspace_id, sort_order);

create table if not exists public.portal_tasks (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  phase_id uuid references public.portal_phases (id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  assignee_id uuid references auth.users (id) on delete set null,
  start_date date,
  due_date date,
  progress integer not null default 0 check (progress between 0 and 100),
  is_milestone boolean not null default false,
  depends_on uuid[] not null default '{}',
  checklist jsonb not null default '[]',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint portal_tasks_dates check (start_date is null or due_date is null or due_date >= start_date)
);
create index if not exists portal_tasks_ws_idx on public.portal_tasks (workspace_id, sort_order);
create index if not exists portal_tasks_due_idx on public.portal_tasks (due_date) where status <> 'done';

create table if not exists public.portal_events (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  kind text not null default 'meeting' check (kind in ('meeting', 'deadline', 'presentation', 'other')),
  title text not null,
  starts_on date not null,
  start_time time,
  end_time time,
  location text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists portal_events_ws_idx on public.portal_events (workspace_id, starts_on);

-- Deadlines staff set once; they show in the calendar of every matching workspace (null = all).
create table if not exists public.portal_deadlines (
  id uuid primary key default gen_random_uuid (),
  title text not null,
  due_date date not null,
  institution text,
  course_code text,
  project_category text check (project_category is null or project_category in ('fyp', 'research', 'innovation')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists portal_deadlines_due_idx on public.portal_deadlines (due_date);

create table if not exists public.portal_documents (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  name text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'draft', 'submitted', 'changes', 'approved')),
  due_date date,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portal_documents_ws_idx on public.portal_documents (workspace_id, sort_order);

create table if not exists public.portal_files (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  document_id uuid references public.portal_documents (id) on delete set null,
  folder text not null default 'General',
  name text not null,
  storage_path text not null unique,
  size_bytes bigint not null default 0,
  mime_type text,
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists portal_files_ws_idx on public.portal_files (workspace_id, created_at desc);

create table if not exists public.portal_logbook (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  entry_date date not null,
  hours numeric(5, 2) check (hours is null or hours >= 0),
  work_done text not null,
  problems text,
  next_steps text,
  author_id uuid references auth.users (id) on delete set null,
  author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portal_logbook_ws_idx on public.portal_logbook (workspace_id, entry_date desc);

create table if not exists public.portal_datasets (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  name text not null,
  notes text,
  columns jsonb not null default '[]',
  rows jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portal_datasets_ws_idx on public.portal_datasets (workspace_id);

create table if not exists public.portal_parts (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  name text not null,
  quantity numeric(10, 2) not null default 1 check (quantity >= 0),
  unit_price_tsh integer not null default 0 check (unit_price_tsh >= 0),
  status text not null default 'needed' check (status in ('needed', 'ordered', 'bought')),
  supplier text,
  link text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portal_parts_ws_idx on public.portal_parts (workspace_id, sort_order);

create table if not exists public.portal_references (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  kind text not null default 'article' check (kind in ('article', 'book', 'website', 'datasheet', 'thesis', 'other')),
  authors text,
  title text not null,
  year text,
  source text,
  volume text,
  pages text,
  url text,
  doi text,
  accessed_on date,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists portal_references_ws_idx on public.portal_references (workspace_id);

create table if not exists public.portal_messages (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  author_kind text not null check (author_kind in ('student', 'staff', 'supervisor')),
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  staff_read_at timestamptz,
  student_read_at timestamptz
);
create index if not exists portal_messages_ws_idx on public.portal_messages (workspace_id, created_at);

create table if not exists public.portal_bookings (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  kind text not null default 'meeting' check (kind in ('meeting', 'lab', 'online')),
  topic text not null,
  preferred_at timestamptz not null,
  duration_min integer not null default 60 check (duration_min between 15 and 480),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'cancelled', 'done')),
  confirmed_at timestamptz,
  staff_note text,
  requested_by uuid references auth.users (id) on delete set null,
  requested_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portal_bookings_ws_idx on public.portal_bookings (workspace_id, preferred_at);

create table if not exists public.portal_comments (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  target_type text not null check (target_type in ('document', 'logbook')),
  target_id uuid not null,
  author_kind text not null check (author_kind in ('student', 'staff', 'supervisor')),
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists portal_comments_target_idx on public.portal_comments (workspace_id, target_type, target_id);

create table if not exists public.portal_invoices (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  description text not null,
  amount_tsh integer not null check (amount_tsh > 0),
  status text not null default 'unpaid' check (status in ('quote', 'unpaid', 'paid', 'cancelled')),
  due_date date,
  reference text unique,
  network text,
  phone text,
  paid_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists portal_invoices_ws_idx on public.portal_invoices (workspace_id, created_at desc);

create table if not exists public.portal_defence_items (
  id uuid primary key default gen_random_uuid (),
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  kind text not null default 'check' check (kind in ('check', 'question')),
  text text not null,
  answer text,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists portal_defence_items_ws_idx on public.portal_defence_items (workspace_id, kind, sort_order);

create table if not exists public.portal_activity (
  id bigserial primary key,
  workspace_id uuid not null references public.portal_workspaces (id) on delete cascade,
  actor_name text not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists portal_activity_ws_idx on public.portal_activity (workspace_id, created_at desc);

create table if not exists public.portal_push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists portal_push_subscriptions_user_idx on public.portal_push_subscriptions (user_id);

alter table public.portal_workspaces enable row level security;
alter table public.portal_workspace_members enable row level security;
alter table public.portal_workspace_invites enable row level security;
alter table public.portal_phases enable row level security;
alter table public.portal_tasks enable row level security;
alter table public.portal_events enable row level security;
alter table public.portal_deadlines enable row level security;
alter table public.portal_documents enable row level security;
alter table public.portal_files enable row level security;
alter table public.portal_logbook enable row level security;
alter table public.portal_datasets enable row level security;
alter table public.portal_parts enable row level security;
alter table public.portal_references enable row level security;
alter table public.portal_messages enable row level security;
alter table public.portal_bookings enable row level security;
alter table public.portal_comments enable row level security;
alter table public.portal_invoices enable row level security;
alter table public.portal_defence_items enable row level security;
alter table public.portal_activity enable row level security;
alter table public.portal_push_subscriptions enable row level security;

-- Private bucket for workspace files (25 MB per file). Uploads use signed URLs created on the server.
insert into storage.buckets (id, name, public, file_size_limit)
values ('portal-files', 'portal-files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
