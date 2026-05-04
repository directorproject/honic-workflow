-- Person assigned to each milestone (timeline activity); free text, same idea as project_tasks.assignee.

alter table public.project_milestones add column if not exists assignee text;

comment on column public.project_milestones.assignee is 'Name of the person responsible for this milestone.';
