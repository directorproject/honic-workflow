-- Highlight markup on the paper (Word-style yellow mark + comment card).

alter table public.portal_review_marks
  drop constraint if exists portal_review_marks_kind_check;

alter table public.portal_review_marks
  add constraint portal_review_marks_kind_check
  check (kind in ('comment', 'draw', 'general', 'highlight'));

alter table public.portal_review_marks
  drop constraint if exists portal_review_marks_page_ck;

alter table public.portal_review_marks
  add constraint portal_review_marks_page_ck check (
    (kind = 'general' and page_number is null)
    or (kind in ('comment', 'draw', 'highlight') and page_number is not null)
  );
