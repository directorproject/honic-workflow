-- Selection (shortlist) is free. Hide from classmates requires plan allowance or payment.
-- hidden_at null = selected for yourself only; set = protected from same institution/course/level.

alter table public.title_selections
  add column if not exists hidden_at timestamptz;

comment on column public.title_selections.hidden_at is
  'When set, peers in the same institution/course/level cannot take this title. Null = personal shortlist only.';

-- Preserve prior behaviour: titles already held were treated as hidden.
update public.title_selections
set hidden_at = coalesce(selected_at, now())
where released_at is null
  and hidden_at is null;

create index if not exists title_selections_hidden_idx
  on public.title_selections (user_id)
  where released_at is null and hidden_at is not null;
