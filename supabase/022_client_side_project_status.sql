-- Add client_side status: pipeline through Full project test is done; client handoff steps remain.
-- Run in Supabase SQL editor after 006_project_tracking.sql.

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'tracked_projects'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
      and pg_get_constraintdef(c.oid) not ilike '%project_type%'
  loop
    execute format('alter table public.tracked_projects drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.tracked_projects
  add constraint tracked_projects_status_check
  check (
    status in (
      'planning',
      'active',
      'prototype_phase',
      'testing',
      'on_hold',
      'client_side',
      'completed'
    )
  );

comment on column public.tracked_projects.status is
  'client_side: our pipeline through Full project test is done; client check / handoff pending. completed: 100% weighted pipeline.';
