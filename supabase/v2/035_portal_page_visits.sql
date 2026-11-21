-- First-party page visits for staff Analytics (pageviews + approximate sessions).
-- App uses service role; RLS on with no policies.

create table if not exists public.portal_visit_days (
  day_key date primary key,
  pageview_count bigint not null default 0 check (pageview_count >= 0),
  session_count bigint not null default 0 check (session_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_path_visits (
  day_key date not null,
  path text not null check (char_length(path) between 1 and 500),
  pageview_count bigint not null default 0 check (pageview_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (day_key, path)
);

-- One row per browser tab-session per day → used to bump session_count once.
create table if not exists public.portal_visit_sessions (
  day_key date not null,
  session_key text not null check (char_length(session_key) between 8 and 80),
  first_path text,
  viewer_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (day_key, session_key)
);

create index if not exists portal_path_visits_count_idx
  on public.portal_path_visits (pageview_count desc);

create index if not exists portal_visit_days_updated_idx
  on public.portal_visit_days (updated_at desc);

alter table public.portal_visit_days enable row level security;
alter table public.portal_path_visits enable row level security;
alter table public.portal_visit_sessions enable row level security;

comment on table public.portal_visit_days is
  'Daily site pageviews and distinct browser sessions (EAT day_key).';
comment on table public.portal_path_visits is
  'Daily pageview counts per path for staff analytics.';
comment on table public.portal_visit_sessions is
  'Session keys seen per day; insert success means a new session for that day.';
