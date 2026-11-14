-- Simpler ownership proof: either upload files (ID / images) or answer verification questions.

alter table public.portal_title_claims
  add column if not exists proof_method text,
  add column if not exists proof_answers jsonb;

alter table public.portal_title_claims drop constraint if exists portal_title_claims_proof_kind_check;
alter table public.portal_title_claims
  add constraint portal_title_claims_proof_kind_check
  check (proof_kind is null or proof_kind in ('national_id', 'student_id', 'passport', 'other', 'questions'));

alter table public.portal_title_claims drop constraint if exists portal_title_claims_proof_method_check;
alter table public.portal_title_claims
  add constraint portal_title_claims_proof_method_check
  check (proof_method is null or proof_method in ('upload', 'questions'));

comment on column public.portal_title_claims.proof_method is
  'upload = ID/image files; questions = answered ownership verification questions.';
comment on column public.portal_title_claims.proof_answers is
  'Answers to ownership verification questions when proof_method = questions.';
