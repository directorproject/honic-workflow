-- Student title portal (share.honiccompany.com/portal).
-- Run after 001_dashboard_baseline.sql. All access is server-side with the service role:
-- tables have RLS on and no anon/authenticated policies; functions are service_role only.

create table if not exists public.courses (
  code text primary key check (code ~ '^[A-Z0-9]{2,12}$'),
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.courses (code, name, sort_order) values
  ('ETE', 'Electronics and Telecommunication Engineering', 1),
  ('COE', 'Computer Engineering', 2)
on conflict (code) do nothing;

alter table public.title_proposals
  add column if not exists course_code text references public.courses (code) on update cascade,
  add column if not exists selected_by uuid references auth.users (id) on delete set null;

update public.title_proposals set course_code = 'ETE' where course_code is null;

create unique index if not exists title_proposals_selected_by_uk
  on public.title_proposals (selected_by) where selected_by is not null;
create index if not exists title_proposals_course_status_idx
  on public.title_proposals (course_code, status);

create table if not exists public.student_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  reg_no text not null,
  phone text not null,
  institution text not null,
  course_code text not null references public.courses (code) on update cascade,
  year_of_study text not null,
  academic_year text not null,
  partner text,
  tracked_project_id uuid references public.tracked_projects (id) on delete set null,
  linked_at timestamptz,
  change_credits integer not null default 0 check (change_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_profiles_reg_no_uk unique (reg_no),
  constraint student_profiles_project_uk unique (tracked_project_id)
);

create table if not exists public.title_selections (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  proposal_id uuid references public.title_proposals (id) on delete set null,
  title text not null,
  selected_at timestamptz not null default now(),
  released_at timestamptz,
  release_reason text
);
create index if not exists title_selections_user_idx on public.title_selections (user_id, selected_at desc);

create table if not exists public.title_change_payments (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null,
  currency text not null default 'TZS',
  provider text not null,
  network text,
  phone text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  reference text not null unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists title_change_payments_user_idx on public.title_change_payments (user_id, created_at desc);

comment on column public.title_change_payments.provider is 'simulated until a real mobile-money provider is connected.';
comment on column public.student_profiles.change_credits is 'Paid (or staff-granted) title changes not yet used.';

alter table public.courses enable row level security;
alter table public.student_profiles enable row level security;
alter table public.title_selections enable row level security;
alter table public.title_change_payments enable row level security;

-- Select a title for a student. First title is free; later selections use a change credit.
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
  if not found or v_prop.status <> 'available' or v_prop.selected_by is not null
     or v_prop.course_code is distinct from v_profile.course_code then
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

-- Record a (simulated) payment, release the current title back to the list, and grant one change credit.
create or replace function public.portal_pay_for_change(
  p_user uuid, p_amount int, p_provider text, p_network text, p_phone text, p_reference text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_profile public.student_profiles%rowtype;
  v_prop public.title_proposals%rowtype;
begin
  select * into v_profile from public.student_profiles where user_id = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;
  if v_profile.tracked_project_id is not null then
    return jsonb_build_object('ok', false, 'error', 'project_started');
  end if;
  select * into v_prop from public.title_proposals where selected_by = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_title');
  end if;

  insert into public.title_change_payments (user_id, amount, provider, network, phone, status, reference, paid_at)
  values (p_user, p_amount, p_provider, p_network, p_phone, 'paid', p_reference, now());

  update public.title_proposals
  set status = 'available', selected_by = null, assigned_to = null, assigned_at = null, updated_at = now()
  where id = v_prop.id;

  update public.title_selections set released_at = now(), release_reason = 'paid_change'
  where user_id = p_user and proposal_id = v_prop.id and released_at is null;

  update public.student_profiles set change_credits = change_credits + 1, updated_at = now() where user_id = p_user;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.portal_select_title(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.portal_pay_for_change(uuid, int, text, text, text, text) from public, anon, authenticated;
grant execute on function public.portal_select_title(uuid, uuid) to service_role;
grant execute on function public.portal_pay_for_change(uuid, int, text, text, text, text) to service_role;
