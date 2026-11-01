-- Removes the workflow dashboard from the old shared shop project (qobobocldfjhdkpjyuuq).
-- Run only after the live dashboard uses the dedicated project (fpzpcsiczzmwppgmoeem).
-- Shop tables, including invoices and the *_backup tables, are not touched.

drop trigger if exists trg_invoices_sync_registered_client on public.invoices;
drop trigger if exists projects_refresh_counts on public.projects;

drop function if exists public.tg_invoices_sync_registered_client();
drop function if exists public.prune_registered_client_by_name(text);
drop function if exists public.delete_registered_client(uuid);
drop function if exists public.get_registered_clients_for_dashboard();
drop function if exists public.get_dashboard_clients();
drop function if exists public.create_project_for_client(uuid, text, text);
drop procedure if exists public.refresh_all_client_counts();
drop procedure if exists public.refresh_single_client_counts(uuid);
drop function if exists public.tg_refresh_client_counts();

drop table if exists public.project_share_push_subscriptions;
drop table if exists public.project_share_links;
drop table if exists public.project_tasks;
drop table if exists public.project_milestones;
drop table if exists public.tracked_projects;
drop table if exists public.registered_clients;
drop table if exists public.title_proposals;
drop table if exists public.last_year_projects;
drop table if exists public.projects;
drop table if exists public.clients;

delete from auth.users where email = 'inova@inova.local';
