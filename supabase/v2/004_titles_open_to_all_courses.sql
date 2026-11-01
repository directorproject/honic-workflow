-- Students may pick a title from any course. Titles can be marked for an institution
-- (null = any institution); course and institution are used only to rank the list.
-- Run after 003_portal_profile_options.sql.

alter table public.title_proposals add column if not exists institution text;

comment on column public.title_proposals.institution is
  'Institution the title is aimed at (null = any). Used to rank titles in the student portal.';

create or replace function public.portal_select_title(p_user uuid, p_proposal uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_profile public.student_profiles%rowtype;
  v_prop public.title_proposals%rowtype;
  v_prior int;
begin
  select * into v_profile from public.student_profiles where user_id = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;
  if exists (select 1 from public.title_proposals where selected_by = p_user) then
    return jsonb_build_object('ok', false, 'error', 'already_has_title');
  end if;
  select count(*) into v_prior from public.title_selections where user_id = p_user;
  if v_prior > 0 and v_profile.change_credits < 1 then
    return jsonb_build_object('ok', false, 'error', 'payment_required');
  end if;

  select * into v_prop from public.title_proposals where id = p_proposal for update;
  if not found or v_prop.status <> 'available' or v_prop.selected_by is not null then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;

  update public.title_proposals
  set status = 'assigned', selected_by = p_user, assigned_to = v_profile.full_name,
      assigned_at = now(), updated_at = now()
  where id = p_proposal;

  insert into public.title_selections (user_id, proposal_id, title) values (p_user, p_proposal, v_prop.title);

  if v_prior > 0 then
    update public.student_profiles set change_credits = change_credits - 1, updated_at = now() where user_id = p_user;
  end if;

  return jsonb_build_object('ok', true, 'title', v_prop.title);
end;
$$;

revoke execute on function public.portal_select_title(uuid, uuid) from public, anon, authenticated;
grant execute on function public.portal_select_title(uuid, uuid) to service_role;
