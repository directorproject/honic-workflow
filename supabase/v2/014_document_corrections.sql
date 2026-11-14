-- Correction loop: what changed since last review (print only this for the supervisor).
-- Status values stay on portal_documents.status (draft / submitted / changes / approved).

alter table public.portal_documents
  add column if not exists change_summary text;

comment on column public.portal_documents.change_summary is
  'Short list of what the student fixed since the last supervisor/Honic feedback — for print summary, not the full document.';
