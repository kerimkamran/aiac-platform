-- Phase 0 security hardening (Vantage UAT plan, A4 and A5). Safe to run twice.
--
--   S-02  Nobody can change their own role, status, organisation or flags.
--   S-03  New accounts are always created as candidates.
--   S-04  Candidates can no longer write their own status, score, answers or
--         competency scores. Starting and submitting go through two functions.
--   S-06  Suspended or deactivated accounts are no longer "staff"; suspending
--         someone ends their sessions.
--   S-07/S-08/S-11  Super Admin accounts can only be changed by a Super Admin;
--         nobody changes their own privileged fields; the last Super Admin
--         cannot be removed. (Enforced here, so it holds for every caller.)
--   S-09  notify_user only reaches the caller or (for staff) anyone, with
--         in-app links only. Audit entries are length-limited.
--   S-10  Only staff can change or delete a test's proctoring settings.
--   E-02  A second submit cannot overwrite a score.
--
-- Run it in the Supabase SQL editor after reviewing. It changes no data.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin_role()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status::text = 'active'
      and role::text in ('hr_admin', 'org_admin', 'system_admin')
  );
$$;
revoke all on function public.is_admin_role() from public, anon;
grant execute on function public.is_admin_role() to authenticated;

-- S-06: a suspended or deactivated account is not staff.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status::text = 'active'
      and role::text in ('recruiter','hiring_manager','hr_admin','org_admin','system_admin')
  );
$$;

create or replace function public.is_staff(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.status::text = 'active'
      and p.role::text in ('recruiter','hiring_manager','hr_admin','org_admin','system_admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- S-03: sign-up metadata can never choose a role
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'candidate'::public.user_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- S-02, S-07, S-08, S-11: one guard on the profiles table
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_changes()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  v_caller_role text;
  v_caller_status text;
  v_other_super int;
begin
  -- Server-side jobs (service role, auth triggers) have no signed-in user.
  if auth.uid() is null or coalesce(current_setting('vantage.provisioning', true), '') = 'on' then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.organization_id is distinct from old.organization_id
     or new.blacklisted is distinct from old.blacklisted
     or new.legal_hold is distinct from old.legal_hold
     or new.anonymized_at is distinct from old.anonymized_at then

    select role::text, status::text into v_caller_role, v_caller_status
    from public.profiles where id = auth.uid();

    if v_caller_status is distinct from 'active'
       or v_caller_role not in ('hr_admin', 'org_admin', 'system_admin') then
      raise exception 'not authorized to change role, status or flags';
    end if;

    -- Nobody changes their own privileged fields (no self-promotion, no lock-out).
    if new.id = auth.uid() then
      raise exception 'use a different admin account to change your own role, status or flags';
    end if;

    -- Super Admin accounts: only a Super Admin may change them or create one.
    if (old.role::text = 'system_admin' or new.role::text = 'system_admin')
       and v_caller_role <> 'system_admin' then
      raise exception 'only a Super Admin can change a Super Admin account';
    end if;

    -- Never remove the last active Super Admin.
    if old.role::text = 'system_admin'
       and old.status::text = 'active'
       and (new.role::text <> 'system_admin' or new.status::text <> 'active') then
      select count(*) into v_other_super
      from public.profiles
      where role::text = 'system_admin' and status::text = 'active' and id <> old.id;
      if v_other_super = 0 then
        raise exception 'cannot remove the last active Super Admin';
      end if;
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.guard_profile_changes() from public, anon, authenticated;

drop trigger if exists guard_profile_changes on public.profiles;
create trigger guard_profile_changes
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- Admins can edit other people's profiles (the guard above limits what).
drop policy if exists "profiles: admin update" on public.profiles;
create policy "profiles: admin update" on public.profiles for update to authenticated
  using (public.is_admin_role()) with check (public.is_admin_role());

-- S-06: ending a person's sessions when they are suspended or deactivated.
create or replace function public.end_sessions_when_inactive()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if new.status::text <> 'active' and old.status::text = 'active' then
    delete from auth.sessions where user_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.end_sessions_when_inactive() from public, anon, authenticated;

drop trigger if exists end_sessions_when_inactive on public.profiles;
create trigger end_sessions_when_inactive
  after update of status on public.profiles
  for each row execute function public.end_sessions_when_inactive();

-- ---------------------------------------------------------------------------
-- S-04 and E-02: candidates start and submit through functions only
-- ---------------------------------------------------------------------------

drop policy if exists "ca: own or staff update" on public.candidate_assessments;
drop policy if exists "ca_candidate_update" on public.candidate_assessments;
create policy "ca: staff update" on public.candidate_assessments for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "responses: own insert" on public.candidate_responses;
drop policy if exists "scores: own insert" on public.candidate_competency_scores;

-- One score per competency per attempt (also what makes a retried submit safe).
do $$ begin
  alter table public.candidate_competency_scores
    add constraint candidate_scores_unique_competency unique (candidate_assessment_id, competency_id);
exception
  when duplicate_object then null;
  when unique_violation then
    raise notice 'candidate_competency_scores has duplicates; the unique rule was not added. Remove the duplicates and run this file again.';
end $$;

-- Start: invited -> in_progress, with the server's clock.
create or replace function public.start_attempt(p_candidate_assessment_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_row public.candidate_assessments%rowtype;
begin
  select * into v_row from public.candidate_assessments
  where id = p_candidate_assessment_id for update;

  if not found or v_row.candidate_id <> auth.uid() then
    raise exception 'not authorized';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and status::text = 'active') then
    raise exception 'account is not active';
  end if;

  if v_row.status = 'invited' then
    update public.candidate_assessments
       set status = 'in_progress', started_at = now()
     where id = v_row.id;
    return now();
  end if;
  return v_row.started_at;
end;
$$;
revoke all on function public.start_attempt(uuid) from public, anon;
grant execute on function public.start_attempt(uuid) to authenticated;

-- Submit gate. Locks the row and moves invited/in_progress -> submitted exactly
-- once. Returns the status before the change, so the app can tell "first
-- submit" from "retry after a failed scoring". 'scored' and 'reviewed' are
-- never touched again.
create or replace function public.begin_submit(p_candidate_assessment_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_row public.candidate_assessments%rowtype;
begin
  select * into v_row from public.candidate_assessments
  where id = p_candidate_assessment_id for update;

  if not found or v_row.candidate_id <> auth.uid() then
    raise exception 'not authorized';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and status::text = 'active') then
    raise exception 'account is not active';
  end if;

  if v_row.status in ('invited', 'in_progress') then
    update public.candidate_assessments
       set status = 'submitted', submitted_at = now()
     where id = v_row.id;
  end if;
  return v_row.status::text;
end;
$$;
revoke all on function public.begin_submit(uuid) from public, anon;
grant execute on function public.begin_submit(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- S-09: notifications and audit entries
-- ---------------------------------------------------------------------------

create or replace function public.notify_user(p_user_id uuid, p_title text, p_body text default '', p_link text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is not null and p_user_id <> auth.uid() and not public.is_staff() then
    raise exception 'not authorized';
  end if;
  if p_link is not null and (left(p_link, 1) <> '/' or left(p_link, 2) = '//') then
    p_link := null;
  end if;
  insert into public.notifications (user_id, title, body, link)
  values (p_user_id, left(p_title, 200), left(coalesce(p_body, ''), 2000), p_link);
end;
$$;
revoke all on function public.notify_user(uuid, text, text, text) from public, anon;
grant execute on function public.notify_user(uuid, text, text, text) to authenticated;

create or replace function public.log_admin_event(
  p_module text, p_action text, p_target_type text default null, p_target_id text default null,
  p_details jsonb default null, p_ip text default null, p_result text default 'success'
) returns void language sql security definer set search_path to 'public' as $$
  insert into public.admin_audit_log (actor_id, module, action, target_type, target_id, details, ip, result)
  values (auth.uid(), left(p_module, 60), left(p_action, 120), left(p_target_type, 60), left(p_target_id, 120),
          p_details, left(p_ip, 64), case when p_result in ('success', 'denied', 'error') then p_result else 'success' end);
$$;
revoke all on function public.log_admin_event(text, text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.log_admin_event(text, text, text, text, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- S-10: proctoring settings are read by everyone, written by staff
-- ---------------------------------------------------------------------------

drop policy if exists "proctoring settings" on public.proctoring_settings;
drop policy if exists "proctoring settings read" on public.proctoring_settings;
drop policy if exists "proctoring settings write" on public.proctoring_settings;
create policy "proctoring settings read" on public.proctoring_settings for select to authenticated using (true);
create policy "proctoring settings write" on public.proctoring_settings for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Multiple-choice grading keeps working during the short "submitted" window
-- (after begin_submit and before scoring finishes), so a retry can complete.
-- ---------------------------------------------------------------------------

create or replace function public.submit_mcq_answer(
  p_candidate_assessment_id uuid,
  p_question_id uuid,
  p_selected_key text
)
returns table (score numeric, rationale text, needs_review boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid;
  v_status public.invitation_status;
  v_options jsonb;
  v_correct_key text;
  v_score numeric;
  v_rationale text;
begin
  select ca.candidate_id, ca.status into v_candidate_id, v_status
  from public.candidate_assessments ca
  where ca.id = p_candidate_assessment_id;

  if v_candidate_id is null or (v_candidate_id <> auth.uid() and not public.is_staff()) then
    raise exception 'not authorized';
  end if;

  if v_status not in ('invited', 'in_progress', 'submitted') then
    raise exception 'this assessment has already been submitted';
  end if;

  select q.options into v_options
  from public.questions q
  join public.assessment_sections s on s.id = q.section_id
  where q.id = p_question_id
    and s.assessment_id = (select assessment_id from public.candidate_assessments where id = p_candidate_assessment_id)
    and q.question_type = 'mcq';

  if v_options is null then
    raise exception 'question not found for this assessment';
  end if;

  select o ->> 'key' into v_correct_key
  from jsonb_array_elements(v_options) o
  where (o ->> 'correct')::boolean is true
  limit 1;

  if p_selected_key is not null and p_selected_key = v_correct_key then
    v_score := 100;
    v_rationale := format('Selected option %s, matching the validated correct answer.', p_selected_key);
  else
    v_score := 0;
    v_rationale := format(
      'Selected option %s; validated correct answer is %s.',
      coalesce(p_selected_key, '(none)'),
      coalesce(v_correct_key, 'unknown')
    );
  end if;

  begin
    insert into public.candidate_responses (candidate_assessment_id, question_id, selected_option, score, ai_rationale)
    values (p_candidate_assessment_id, p_question_id, p_selected_key, v_score, v_rationale);
  exception when unique_violation then
    raise exception 'this question has already been answered and scored';
  end;

  return query select v_score, v_rationale, (v_score < 100);
end;
$$;

revoke all on function public.submit_mcq_answer(uuid, uuid, text) from public;
grant execute on function public.submit_mcq_answer(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- A-05, A-07: who may create accounts, and one test per person
-- ---------------------------------------------------------------------------
-- Recruiters and hiring managers may create CANDIDATE accounts. Staff accounts
-- need an admin (HR, org or Super Admin); admin-level accounts need a Super
-- Admin. The decision-maker role is no longer provisioned.

create or replace function public.admin_provision_user(p_email text, p_full_name text, p_role text default 'candidate', p_department text default null)
returns table(profile_id uuid, created boolean)
language plpgsql security definer set search_path to 'public', 'auth', 'extensions' as $function$
declare
  v_email text := lower(trim(p_email));
  v_uid uuid;
  v_org uuid;
  v_created boolean := false;
begin
  if not public.is_staff() then raise exception 'not authorized'; end if;
  if p_role not in ('candidate', 'recruiter', 'hiring_manager', 'hr_admin', 'org_admin', 'system_admin') then
    raise exception 'invalid role';
  end if;
  if p_role in ('recruiter', 'hiring_manager') and not public.is_admin_role() then
    raise exception 'only an admin can add staff';
  end if;
  if p_role in ('hr_admin', 'org_admin', 'system_admin') and not public.is_super_admin() then
    raise exception 'only the super admin can grant that role';
  end if;

  select id into v_uid from public.profiles where email = v_email;

  if v_uid is null then
    select id into v_org from public.organizations limit 1;
    v_uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_email, crypt(encode(gen_random_bytes(18), 'base64'), gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', p_full_name),
      '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text, jsonb_build_object('sub', v_uid::text, 'email', v_email), 'email', now(), now(), now());

    -- This function has already checked who may create which role, so the
    -- profile guard lets this one update through.
    perform set_config('vantage.provisioning', 'on', true);
    update public.profiles
      set full_name = p_full_name, role = p_role::public.user_role,
          department = coalesce(p_department, department),
          organization_id = coalesce(organization_id, v_org)
      where id = v_uid;
    perform set_config('vantage.provisioning', 'off', true);

    v_created := true;

    insert into public.admin_audit_log (actor_id, action, target_user_id, details)
    values (auth.uid(), 'user_invited', v_uid, jsonb_build_object('email', v_email, 'role', p_role, 'department', p_department));
  end if;

  return query select v_uid, v_created;
end;
$function$;
revoke all on function public.admin_provision_user(text, text, text, text) from public, anon;
grant execute on function public.admin_provision_user(text, text, text, text) to authenticated;

-- One row per person per test.
do $$ begin
  alter table public.candidate_assessments
    add constraint candidate_assessments_unique_pair unique (assessment_id, candidate_id);
exception
  when duplicate_object then null;
  when unique_violation then
    raise notice 'candidate_assessments has duplicate (test, person) rows; the unique rule was not added. Remove the duplicates and run this file again.';
end $$;
