-- Milestone workflow on /plans board (pending → in progress → blocked → done).
-- Run in Supabase SQL editor after prior migrations.

alter table public.project_milestones
  add column if not exists work_status text not null default 'pending'
  check (work_status in ('pending', 'in_progress', 'blocked', 'done'));

update public.project_milestones
set work_status = 'done'
where completed_at is not null;

comment on column public.project_milestones.work_status is
  'Lifecycle for plans board; done sets completed_at; reopen clears completed_at.';
