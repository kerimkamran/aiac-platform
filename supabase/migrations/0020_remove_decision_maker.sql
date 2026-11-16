-- Removing the decision-maker role (Vantage UAT plan, A6). Safe to run twice.
--
-- STEP 1, before running this file (people, not code): list the accounts and
-- agree with HR what each becomes. The default is hiring manager.
--
--   select id, email, full_name from public.profiles where role::text = 'decision_maker';
--
-- When HR has agreed, move them (an admin signed in to the app can also do
-- this on the People screen):
--
--   update public.profiles set role = 'hiring_manager' where role::text = 'decision_maker';
--
-- The app no longer has a decision-maker portal, so an account left on this
-- role can sign in but has no home page.
--
-- STEP 2, this file. Postgres cannot remove a value from an enum without
-- rebuilding the type, so the value stays in the type and is blocked instead.
-- The policies from 0002, 0007 and 0010 call is_assigned_decision_maker();
-- rather than rewrite each one (the live database may differ from the repo),
-- the function now answers "no" for everyone, so they only ever grant what
-- the staff part of the same rule already grants.

create or replace function public.is_assigned_decision_maker(p_ca_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select false;
$$;

-- No new or changed row may hold the value. NOT VALID leaves existing rows
-- alone; run `alter table public.profiles validate constraint profiles_no_decision_maker;`
-- once STEP 1 is done.
do $$ begin
  alter table public.profiles
    add constraint profiles_no_decision_maker check (role::text <> 'decision_maker') not valid;
exception when duplicate_object then null; end $$;

-- Role changes and provisioning refuse the value (0019 already removed it from
-- admin_provision_user); admin_update_user_role is tightened here.
create or replace function public.admin_update_user_role(p_user_id uuid, p_role text, p_department text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_old_role public.user_role;
  v_old_department text;
  v_admin_count int;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status::text = 'active' and role in ('hr_admin', 'system_admin')) then
    raise exception 'not authorized';
  end if;
  if p_user_id = auth.uid() then raise exception 'use a different admin account to change your own role'; end if;
  if p_role not in ('candidate', 'recruiter', 'hiring_manager', 'hr_admin', 'org_admin', 'system_admin') then
    raise exception 'invalid role';
  end if;
  if p_role in ('hr_admin', 'org_admin', 'system_admin') and not public.is_super_admin() then
    raise exception 'only the super admin can grant that role';
  end if;

  select role, department into v_old_role, v_old_department from public.profiles where id = p_user_id;
  if v_old_role is null then raise exception 'user not found'; end if;

  if v_old_role = 'system_admin' and p_role <> 'system_admin' then
    select count(*) into v_admin_count from public.profiles where role = 'system_admin' and status = 'active';
    if v_admin_count <= 1 then raise exception 'cannot demote the last remaining super admin'; end if;
  end if;

  update public.profiles
    set role = p_role::public.user_role,
        -- A null department means "leave it as it is" (ADM-B-10).
        department = case when p_department is null then department else nullif(trim(p_department), '') end
    where id = p_user_id;

  insert into public.admin_audit_log (actor_id, action, target_user_id, details)
  values (auth.uid(), 'role_updated', p_user_id,
    jsonb_build_object('old_role', v_old_role, 'new_role', p_role, 'old_department', v_old_department, 'new_department', p_department));
end;
$function$;
revoke all on function public.admin_update_user_role(uuid, text, text) from public, anon;
grant execute on function public.admin_update_user_role(uuid, text, text) to authenticated;

-- The table that recorded who was assigned is no longer read or written by the
-- app. It is kept for now so nothing is lost; drop it after HR confirms:
--   drop table public.candidate_decision_makers;
