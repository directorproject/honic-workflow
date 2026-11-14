-- Both title slots are free. Payment is only for changing a held title (portal_pay_for_change).
-- Replaces the old rule: first free, second requires change_credits.

create or replace function public.portal_select_title(p_user uuid, p_proposal uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_profile public.student_profiles%rowtype;
  v_prop public.title_proposals%rowtype;
  v_held int;
  v_max constant int := 2;
begin
  select * into v_profile from public.student_profiles where user_id = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;

  select count(*) into v_held
  from public.title_selections
  where user_id = p_user and released_at is null;

  if v_held >= v_max then
    return jsonb_build_object('ok', false, 'error', 'already_has_title');
  end if;

  if exists (
    select 1 from public.title_selections
    where user_id = p_user and released_at is null and proposal_id = p_proposal
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_has_title');
  end if;

  select * into v_prop from public.title_proposals where id = p_proposal for update;
  if not found or v_prop.status <> 'available' or v_prop.selected_by is not null then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;

  update public.title_proposals
  set status = 'assigned', selected_by = p_user, assigned_to = v_profile.full_name,
      assigned_at = now(), updated_at = now()
  where id = p_proposal;

  insert into public.title_selections (user_id, proposal_id, title)
  values (p_user, p_proposal, v_prop.title);

  return jsonb_build_object('ok', true, 'title', v_prop.title);
end;
$$;

revoke execute on function public.portal_select_title(uuid, uuid) from public, anon, authenticated;
grant execute on function public.portal_select_title(uuid, uuid) to service_role;

comment on function public.portal_select_title(uuid, uuid) is
  'Student may hold up to two titles for free. Changing a held title still uses portal_pay_for_change.';
