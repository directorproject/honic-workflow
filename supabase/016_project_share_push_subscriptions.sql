-- Web Push subscriptions for public share links.
-- One browser endpoint can subscribe once per project.

create table if not exists public.project_share_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tracked_project_id uuid not null references public.tracked_projects(id) on delete cascade,
  share_token text not null references public.project_share_links(token) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tracked_project_id, endpoint)
);

create index if not exists idx_project_share_push_subscriptions_project_id
  on public.project_share_push_subscriptions (tracked_project_id);

create index if not exists idx_project_share_push_subscriptions_share_token
  on public.project_share_push_subscriptions (share_token);
