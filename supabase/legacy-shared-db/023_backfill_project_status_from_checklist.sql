-- One-time backfill: move existing projects to client_side / completed from workflow_checklist.
-- Matches app logic in src/lib/workflow-checklist.ts (weighted % and Full project test gate).
-- Run after 022_client_side_project_status.sql. Safe to re-run.

create or replace function public.workflow_checklist_step_weight(p_status text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(nullif(trim(p_status), ''), 'pending') in ('done', 'not_provided') then 1::numeric
    when coalesce(nullif(trim(p_status), ''), 'pending') = 'in_progress' then 0.5
    else 0::numeric
  end;
$$;

create or replace function public.workflow_checklist_step_addressed(p_status text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(nullif(trim(p_status), ''), 'pending') in ('done', 'not_provided');
$$;

create or replace function public.workflow_checklist_weighted_points(p_checklist jsonb)
returns numeric
language sql
immutable
set search_path = public
as $$
  select
    public.workflow_checklist_step_weight(p_checklist->>'schematic_circuit')
    + public.workflow_checklist_step_weight(p_checklist->>'circuit_simulation')
    + public.workflow_checklist_step_weight(p_checklist->>'pcb_layout')
    + public.workflow_checklist_step_weight(p_checklist->>'pcb_fabrication')
    + public.workflow_checklist_step_weight(p_checklist->>'programming')
    + public.workflow_checklist_step_weight(p_checklist->>'assembling_test')
    + public.workflow_checklist_step_weight(p_checklist->>'prototype')
    + public.workflow_checklist_step_weight(p_checklist->>'full_project_test')
    + public.workflow_checklist_step_weight(p_checklist->>'client_check')
    + public.workflow_checklist_step_weight(p_checklist->>'give_to_client');
$$;

create or replace function public.workflow_checklist_through_full_project_test(p_checklist jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    public.workflow_checklist_step_addressed(p_checklist->>'schematic_circuit')
    and public.workflow_checklist_step_addressed(p_checklist->>'circuit_simulation')
    and public.workflow_checklist_step_addressed(p_checklist->>'pcb_layout')
    and public.workflow_checklist_step_addressed(p_checklist->>'pcb_fabrication')
    and public.workflow_checklist_step_addressed(p_checklist->>'programming')
    and public.workflow_checklist_step_addressed(p_checklist->>'assembling_test')
    and public.workflow_checklist_step_addressed(p_checklist->>'prototype')
    and public.workflow_checklist_step_addressed(p_checklist->>'full_project_test');
$$;

-- 100% weighted pipeline (10/10 points) → completed
update public.tracked_projects p
set
  status = 'completed',
  updated_at = now()
where public.workflow_checklist_weighted_points(coalesce(p.workflow_checklist, '{}'::jsonb)) >= 10
  and p.status is distinct from 'completed';

-- Through Full project test, not yet 100% → client_side
update public.tracked_projects p
set
  status = 'client_side',
  updated_at = now()
where public.workflow_checklist_through_full_project_test(coalesce(p.workflow_checklist, '{}'::jsonb))
  and public.workflow_checklist_weighted_points(coalesce(p.workflow_checklist, '{}'::jsonb)) < 10
  and p.status is distinct from 'client_side'
  and p.status is distinct from 'completed';

-- Optional: see what was updated (run separately if you want a report)
-- select id, title, status, workflow_checklist_weighted_points(workflow_checklist) as pts
-- from tracked_projects
-- where status in ('client_side', 'completed')
-- order by updated_at desc;
