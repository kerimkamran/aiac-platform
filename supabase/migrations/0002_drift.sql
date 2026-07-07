-- 0002: Reconcile repo migrations with the live project (objects added directly
-- in production since 0001). Safe to run on a fresh DB or as a no-op live.

alter type public.user_role add value if not exists 'decision_maker';

-- ---------- Columns added live ----------
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.assessments
  add column if not exists vacancy_title text,
  add column if not exists mode text not null default 'manual',
  add column if not exists engine text,
  add column if not exists generated_by uuid references public.profiles (id),
  add column if not exists generated_at timestamptz,
  add column if not exists content_language text;
alter table public.candidate_assessments
  add column if not exists tab_switch_count integer,
  add column if not exists language text;

-- ---------- Tables added live ----------
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id),
  template_key text not null unique,
  subject text not null default '',
  body_html text not null default '',
  image_url text,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_decision_makers (
  id uuid primary key default gen_random_uuid(),
  candidate_assessment_id uuid not null references public.candidate_assessments (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id),
  assigned_at timestamptz not null default now(),
  unique (candidate_assessment_id, profile_id)
);

create table if not exists public.proctoring_settings (
  assessment_id uuid primary key references public.assessments (id) on delete cascade,
  camera_enabled boolean not null default false,
  storage_backend text not null default 'supabase' check (storage_backend in ('supabase', 'local')),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table if not exists public.proctoring_recordings (
  id uuid primary key default gen_random_uuid(),
  candidate_assessment_id uuid not null references public.candidate_assessments (id) on delete cascade,
  storage_path text,
  consent_given_at timestamptz,
  duration_seconds numeric,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  target_user_id uuid references public.profiles (id),
  details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_engines (
  key text primary key,
  display_name text not null,
  api_key text,
  enabled boolean not null default false,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_library (
  id uuid primary key default gen_random_uuid(),
  competency_id uuid references public.competencies (id),
  title text,
  scenario_text text,
  question_stem text,
  question_type text,
  options jsonb,
  difficulty text,
  methodology_tag text,
  methodology_notes text,
  engine text,
  generated_by uuid references public.profiles (id),
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.email_templates enable row level security;
alter table public.candidate_decision_makers enable row level security;
alter table public.proctoring_settings enable row level security;
alter table public.proctoring_recordings enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.generation_engines enable row level security;
alter table public.case_library enable row level security;

drop policy if exists "templates staff" on public.email_templates;
create policy "templates staff" on public.email_templates for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists "cdm staff or self" on public.candidate_decision_makers;
create policy "cdm staff or self" on public.candidate_decision_makers for all to authenticated
  using (public.is_staff() or profile_id = auth.uid()) with check (public.is_staff());
drop policy if exists "proctoring settings" on public.proctoring_settings;
create policy "proctoring settings" on public.proctoring_settings for all to authenticated
  using (true) with check (public.is_staff());
drop policy if exists "proctoring recordings" on public.proctoring_recordings;
create policy "proctoring recordings" on public.proctoring_recordings for all to authenticated
  using (
    public.is_staff() or exists (
      select 1 from public.candidate_assessments ca
      where ca.id = candidate_assessment_id and ca.candidate_id = auth.uid()
    )
  )
  with check (
    public.is_staff() or exists (
      select 1 from public.candidate_assessments ca
      where ca.id = candidate_assessment_id and ca.candidate_id = auth.uid()
    )
  );
drop policy if exists "audit staff read" on public.admin_audit_log;
create policy "audit staff read" on public.admin_audit_log for select to authenticated using (public.is_staff());
drop policy if exists "audit insert" on public.admin_audit_log;
create policy "audit insert" on public.admin_audit_log for insert to authenticated with check (actor_id = auth.uid());
drop policy if exists "engines admin" on public.generation_engines;
create policy "engines admin" on public.generation_engines for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('hr_admin', 'system_admin')))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('hr_admin', 'system_admin')));
drop policy if exists "cases staff" on public.case_library;
create policy "cases staff" on public.case_library for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------- Functions added live ----------
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'system_admin');
$$;

create or replace function public.is_assigned_decision_maker(p_ca_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.candidate_decision_makers
    where candidate_assessment_id = p_ca_id and profile_id = auth.uid()
  );
$$;

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
  if p_role not in ('candidate', 'decision_maker', 'recruiter', 'hiring_manager', 'hr_admin', 'system_admin') then
    raise exception 'invalid role';
  end if;
  if p_role in ('hr_admin', 'system_admin') and not public.is_super_admin() then
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
      jsonb_build_object('full_name', p_full_name, 'role', p_role),
      '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text, jsonb_build_object('sub', v_uid::text, 'email', v_email), 'email', now(), now(), now());

    update public.profiles
      set full_name = p_full_name, role = p_role::public.user_role,
          department = coalesce(p_department, department),
          organization_id = coalesce(organization_id, v_org)
      where id = v_uid;

    v_created := true;

    insert into public.admin_audit_log (actor_id, action, target_user_id, details)
    values (auth.uid(), 'user_invited', v_uid, jsonb_build_object('email', v_email, 'role', p_role, 'department', p_department));
  end if;

  return query select v_uid, v_created;
end;
$function$;

create or replace function public.admin_update_user_role(p_user_id uuid, p_role text, p_department text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_old_role public.user_role;
  v_old_department text;
  v_admin_count int;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('hr_admin', 'system_admin')) then
    raise exception 'not authorized';
  end if;
  if p_user_id = auth.uid() then raise exception 'use a different admin account to change your own role'; end if;
  if p_role not in ('candidate', 'decision_maker', 'recruiter', 'hiring_manager', 'hr_admin', 'system_admin') then
    raise exception 'invalid role';
  end if;
  if p_role in ('hr_admin', 'system_admin') and not public.is_super_admin() then
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
        department = nullif(trim(coalesce(p_department, '')), '')
    where id = p_user_id;

  insert into public.admin_audit_log (actor_id, action, target_user_id, details)
  values (auth.uid(), 'role_updated', p_user_id,
    jsonb_build_object('old_role', v_old_role, 'new_role', p_role, 'old_department', v_old_department, 'new_department', p_department));
end;
$function$;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_role public.user_role;
  v_admin_count int;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('hr_admin', 'system_admin')) then
    raise exception 'not authorized';
  end if;
  if p_user_id = auth.uid() then raise exception 'use a different admin account to change your own status'; end if;
  if p_status not in ('active', 'deactivated') then raise exception 'invalid status'; end if;

  select role into v_role from public.profiles where id = p_user_id;
  if v_role is null then raise exception 'user not found'; end if;

  if v_role = 'system_admin' and p_status = 'deactivated' then
    select count(*) into v_admin_count from public.profiles where role = 'system_admin' and status = 'active';
    if v_admin_count <= 1 then raise exception 'cannot deactivate the last remaining super admin'; end if;
  end if;

  update public.profiles set status = p_status where id = p_user_id;

  insert into public.admin_audit_log (actor_id, action, target_user_id, details)
  values (auth.uid(), case when p_status = 'deactivated' then 'user_deactivated' else 'user_reactivated' end, p_user_id, jsonb_build_object('status', p_status));
end;
$function$;

-- Storage buckets used by the app
insert into storage.buckets (id, name, public) values ('proctoring', 'proctoring', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('email-assets', 'email-assets', true) on conflict (id) do nothing;
