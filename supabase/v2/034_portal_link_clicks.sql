-- First-party link click analytics (portal CTAs, footer, WhatsApp, etc.).
-- App uses service role; RLS on with no policies.

create table if not exists public.portal_link_clicks (
  link_key text primary key check (char_length(link_key) between 1 and 120),
  label text not null default '',
  href text not null default '',
  click_count bigint not null default 0 check (click_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_link_click_events (
  id uuid primary key default gen_random_uuid(),
  link_key text not null references public.portal_link_clicks (link_key) on delete cascade,
  viewer_id uuid references auth.users (id) on delete set null,
  source_path text,
  day_key date,
  created_at timestamptz not null default now()
);

create index if not exists portal_link_click_events_key_idx
  on public.portal_link_click_events (link_key, created_at desc);

-- One counted click per signed-in viewer per link per day (EAT day_key from app).
create unique index if not exists portal_link_click_day_uk
  on public.portal_link_click_events (link_key, viewer_id, day_key)
  where viewer_id is not null and day_key is not null;

alter table public.portal_link_clicks enable row level security;
alter table public.portal_link_click_events enable row level security;

comment on table public.portal_link_clicks is
  'Aggregated outbound / CTA link clicks for the staff analytics page.';
comment on table public.portal_link_click_events is
  'Raw link click events; signed-in viewers are deduped per link per day.';
