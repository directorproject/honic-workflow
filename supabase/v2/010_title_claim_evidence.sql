-- Ownership claims require sealed evidence (project documents + identity proof).
-- Appeals are allowed when a title already has a confirmed owner, with strong references.
-- Students cannot change a sealed claim; staff review evidence before confirming payment-grade ownership.

alter table public.portal_title_claims drop constraint if exists portal_title_claims_request_kind_check;
alter table public.portal_title_claims drop constraint if exists portal_title_claims_target;

alter table public.portal_title_claims
  add column if not exists id_number text,
  add column if not exists proof_kind text,
  add column if not exists integrity_hash text,
  add column if not exists sealed_at timestamptz;

alter table public.portal_title_claims
  add constraint portal_title_claims_request_kind_check
  check (request_kind in ('claim', 'new', 'appeal'));

alter table public.portal_title_claims
  add constraint portal_title_claims_proof_kind_check
  check (proof_kind is null or proof_kind in ('national_id', 'student_id', 'passport', 'other'));

alter table public.portal_title_claims
  add constraint portal_title_claims_target check (
    (request_kind in ('claim', 'appeal') and target_kind is not null and target_id is not null)
    or (request_kind = 'new' and status <> 'confirmed' and target_id is null)
    or (request_kind = 'new' and status = 'confirmed' and target_kind = 'proposal' and target_id is not null)
  );

create table if not exists public.portal_title_claim_evidence (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  claim_id uuid not null references public.portal_title_claims (id) on delete cascade,
  kind text not null check (kind in ('project_document', 'id_proof', 'reference')),
  name text not null,
  storage_path text not null unique,
  size_bytes bigint not null default 0,
  mime_type text,
  sha256 text not null,
  created_at timestamptz not null default now()
);

create index if not exists portal_title_claim_evidence_claim_idx
  on public.portal_title_claim_evidence (claim_id, kind, created_at desc);

alter table public.portal_title_claim_evidence enable row level security;

comment on table public.portal_title_claim_evidence is
  'Immutable evidence attached when a student submits an ownership claim, new title, or appeal. Reviewed by staff before confirmation.';
comment on column public.portal_title_claims.integrity_hash is
  'Server-computed seal over claim fields and evidence file hashes. Detects tampering.';
comment on column public.portal_title_claims.sealed_at is
  'When the claim was locked for review. Students cannot edit after this.';
