-- Peer-help escrow: lock poster funds, watermarked preview, release/refund, helper payout queue.

-- Keep legacy statuses; escrow lifecycle lives in portal_job_escrows.
-- open | assigned | closed | cancelled remain on portal_jobs.

create table if not exists public.portal_job_escrows (
  id uuid primary key default gen_random_uuid (),
  public_id text not null unique,
  job_id uuid not null references public.portal_jobs (id) on delete cascade,
  application_id uuid not null references public.portal_job_applications (id) on delete cascade,
  poster_user_id uuid not null references auth.users (id) on delete cascade,
  helper_user_id uuid not null references auth.users (id) on delete cascade,
  amount_tsh integer not null check (amount_tsh >= 1000),
  currency text not null default 'TZS',
  status text not null default 'awaiting_funds'
    check (status in (
      'awaiting_funds',
      'locked',
      'delivered',
      'disputed',
      'released',
      'refunded',
      'cancelled'
    )),
  payment_id uuid,
  payment_reference text,
  review_hours integer not null default 48 check (review_hours between 1 and 168),
  locked_at timestamptz,
  delivered_at timestamptz,
  review_deadline_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  cancelled_at timestamptz,
  dispute_reason text,
  dispute_opened_by uuid references auth.users (id) on delete set null,
  dispute_opened_at timestamptz,
  dispute_resolution text,
  dispute_resolved_by uuid references auth.users (id) on delete set null,
  dispute_resolved_at timestamptz,
  integrity_hash text not null,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint portal_job_escrows_job_unique unique (job_id),
  constraint portal_job_escrows_app_unique unique (application_id)
);

create index if not exists portal_job_escrows_status_idx
  on public.portal_job_escrows (status, updated_at desc);

create index if not exists portal_job_escrows_poster_idx
  on public.portal_job_escrows (poster_user_id, created_at desc);

create index if not exists portal_job_escrows_helper_idx
  on public.portal_job_escrows (helper_user_id, created_at desc);

create index if not exists portal_job_escrows_deadline_idx
  on public.portal_job_escrows (status, review_deadline_at)
  where status = 'delivered';

create table if not exists public.portal_job_deliverables (
  id uuid primary key default gen_random_uuid (),
  public_id text not null unique,
  escrow_id uuid not null references public.portal_job_escrows (id) on delete cascade,
  uploader_user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('preview', 'final')),
  storage_path text not null,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 26214400),
  content_sha256 text not null,
  original_name text not null,
  created_at timestamptz not null default now (),
  constraint portal_job_deliverables_one_kind unique (escrow_id, kind)
);

create index if not exists portal_job_deliverables_escrow_idx
  on public.portal_job_deliverables (escrow_id, kind);

-- Short-lived preview sessions (token hash only — never store raw tokens).
create table if not exists public.portal_job_preview_sessions (
  id uuid primary key default gen_random_uuid (),
  deliverable_id uuid not null references public.portal_job_deliverables (id) on delete cascade,
  viewer_user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  max_views integer not null default 25,
  view_count integer not null default 0,
  last_seen_at timestamptz,
  created_at timestamptz not null default now (),
  constraint portal_job_preview_sessions_views check (view_count >= 0 and view_count <= max_views)
);

create index if not exists portal_job_preview_sessions_viewer_idx
  on public.portal_job_preview_sessions (viewer_user_id, expires_at desc);

-- Peer-help payout destination (separate from title-claim payouts).
create table if not exists public.portal_peer_payout_accounts (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  network text not null,
  phone text not null,
  account_name text not null,
  registered_name text not null,
  status text not null default 'active' check (status in ('active', 'locked', 'revoked')),
  integrity_hash text not null,
  locked_at timestamptz,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint portal_peer_payout_accounts_user_unique unique (user_id)
);

create table if not exists public.portal_job_payouts (
  id uuid primary key default gen_random_uuid (),
  public_id text not null unique,
  escrow_id uuid not null unique references public.portal_job_escrows (id) on delete cascade,
  helper_user_id uuid not null references auth.users (id) on delete cascade,
  amount_tsh integer not null check (amount_tsh >= 1000),
  network text,
  phone text,
  account_name text,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'paid', 'failed', 'cancelled')),
  paid_at timestamptz,
  failure_reason text,
  integrity_hash text not null,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now ()
);

create index if not exists portal_job_payouts_status_idx
  on public.portal_job_payouts (status, created_at desc);

comment on table public.portal_job_escrows is
  'Peer-help escrow: poster funds locked until confirm, auto-release, refund, or staff dispute resolution.';

comment on table public.portal_job_deliverables is
  'preview = watermarked review only; final = unlocked after escrow release.';

comment on table public.portal_job_preview_sessions is
  'Hashed short-lived preview tokens with view caps. Raw tokens never stored.';

alter table public.portal_job_escrows enable row level security;
alter table public.portal_job_deliverables enable row level security;
alter table public.portal_job_preview_sessions enable row level security;
alter table public.portal_peer_payout_accounts enable row level security;
alter table public.portal_job_payouts enable row level security;
