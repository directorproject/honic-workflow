-- Title engagement for confirmed ownership: title opens (clicks) and document buys/opens.
-- App uses service role; RLS on with no policies (same as other portal tables).

create table if not exists public.portal_title_engagement (
  target_kind text not null check (target_kind in ('proposal', 'earlier')),
  target_id uuid not null,
  click_count bigint not null default 0 check (click_count >= 0),
  buy_count bigint not null default 0 check (buy_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (target_kind, target_id)
);

create table if not exists public.portal_title_engagement_events (
  id uuid primary key default gen_random_uuid(),
  target_kind text not null check (target_kind in ('proposal', 'earlier')),
  target_id uuid not null,
  kind text not null check (kind in ('click', 'buy')),
  viewer_id uuid references auth.users (id) on delete set null,
  document_id uuid,
  day_key date,
  created_at timestamptz not null default now()
);

create index if not exists portal_title_engagement_events_target_idx
  on public.portal_title_engagement_events (target_kind, target_id, kind, created_at desc);

-- One click per viewer per title per day (day_key filled by app in EAT).
create unique index if not exists portal_title_engagement_click_day_uk
  on public.portal_title_engagement_events (target_kind, target_id, viewer_id, day_key)
  where kind = 'click' and viewer_id is not null and day_key is not null;

-- One buy per viewer per document.
create unique index if not exists portal_title_engagement_buy_doc_uk
  on public.portal_title_engagement_events (target_kind, target_id, viewer_id, document_id)
  where kind = 'buy' and viewer_id is not null and document_id is not null;

alter table public.portal_title_engagement enable row level security;
alter table public.portal_title_engagement_events enable row level security;

comment on table public.portal_title_engagement is
  'Aggregated title clicks and document buys shown to the confirmed owner.';
comment on table public.portal_title_engagement_events is
  'Raw engagement events used to keep click/buy counts unique where possible.';
