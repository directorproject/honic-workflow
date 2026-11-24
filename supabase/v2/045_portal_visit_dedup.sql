-- Throttle repeat pageviews: same session or signed-in user + path within a short window.

create table if not exists public.portal_visit_recent (
  day_key date not null,
  identity_key text not null check (char_length(identity_key) between 2 and 120),
  path text not null check (char_length(path) between 1 and 500),
  last_seen_at timestamptz not null default now(),
  primary key (day_key, identity_key, path)
);

create index if not exists portal_visit_recent_last_seen_idx
  on public.portal_visit_recent (last_seen_at desc);

alter table public.portal_visit_recent enable row level security;

comment on table public.portal_visit_recent is
  'Last open time per path per browser session or viewer id; used to avoid counting rapid refreshes as new pageviews.';