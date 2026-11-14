-- Desk membership + title hide rules:
-- paid plan: 2 free hides; free mode: 0 free hides; each extra hide is paid (app-side fee).

alter table public.student_profiles
  add column if not exists desk_plan text,
  add column if not exists desk_expires_at timestamptz;

comment on column public.student_profiles.desk_plan is
  'Active membership product id (year | semester) when desk_expires_at is in the future.';
comment on column public.student_profiles.desk_expires_at is
  'When desk membership ends. Null or past = free mode (every title hide is paid).';
comment on column public.student_profiles.change_credits is
  'Paid hide credits not yet used (buy with Snippe, then hide/select a title).';

create or replace function public.portal_select_title(p_user uuid, p_proposal uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_profile public.student_profiles%rowtype;
  v_prop public.title_proposals%rowtype;
  v_held int;
  v_free int;
  v_max constant int := 20;
  v_paid_plan boolean;
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

  v_paid_plan := v_profile.desk_expires_at is not null and v_profile.desk_expires_at > now();
  v_free := case when v_paid_plan then 2 else 0 end;

  if v_held >= v_free then
    if v_profile.change_credits < 1 then
      return jsonb_build_object('ok', false, 'error', 'payment_required_hide');
    end if;
    update public.student_profiles
      set change_credits = change_credits - 1, updated_at = now()
      where user_id = p_user;
  end if;

  select * into v_prop from public.title_proposals where id = p_proposal for update;
  if not found or v_prop.status <> 'available' or v_prop.selected_by is not null then
    if v_held >= v_free then
      update public.student_profiles
        set change_credits = change_credits + 1, updated_at = now()
        where user_id = p_user;
    end if;
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
  'Hide/select a title. Paid desk: 2 free; free mode / 3rd+: consumes change_credits.';
