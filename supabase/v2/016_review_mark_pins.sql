-- Pin position so comments sit on the paper at the corrected spot (normalized 0..1).

alter table public.portal_review_marks
  add column if not exists pin_x double precision,
  add column if not exists pin_y double precision;

comment on column public.portal_review_marks.pin_x is
  'Horizontal position on the page (0 left to 1 right) for on-paper comments.';
comment on column public.portal_review_marks.pin_y is
  'Vertical position on the page (0 top to 1 bottom) for on-paper comments.';
