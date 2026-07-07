-- 0004: Enterprise Admin Panel — RBAC permissions, org units, extended profiles,
-- hardened audit, notifications, approvals, settings, data governance, dual-audience.

-- ---------- Extended profile fields ----------
alter table public.profiles
  add column if not exists phone text,
  add column if not exists job_title text,
  add column if not exists business_unit text,
  add column if not exists location text,
  add column if not exists manager_id uuid references public.profiles (id),
  add column if not exists org_unit_id uuid,
  add column if not exists last_login_at timestamptz,
  add column if not exists custom_fields jsonb not null default '{}'::jsonb,
  add column if not exists is_employee boolean not null default false,
  add column if not exists employee_id text,
  add column if not exists hire_date date,
  add column if not exists blacklisted boolean not null default false,
  add column if not exists legal_hold boolean not null default false,
  add column if not exists consent_at timestamptz,
  add column if not exists expertise text[],
  add column if not exists certifications jsonb,
  add column if not exists availability text not null default 'available',
  add column if not exists max_workload integer not null default 5,
  add column if not exists anonymized_at timestamptz;

-- Assessment purpose: hiring vs internal promotion/development
alter table public.assessments
  add column if not exists purpose text not null default 'hiring'
    check (purpose in ('hiring', 'promotion', 'development'));

-- ---------- Organization units (BU / department / team / location tree) ----------
create table if not exists public.org_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  parent_id uuid references public.org_units (id) on delete cascade,
  unit_type text not null check (unit_type in ('business_unit', 'department', 'team', 'location')),
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.profiles
  add constraint profiles_org_unit_fk foreign key (org_unit_id) references public.org_units (id) on delete set null;

-- ---------- RBAC: permissions, role grants, per-user overrides ----------
create table if not exists public.permissions (
  id serial primary key,
  module text not null,
  action text not null,
  unique (module, action)
);

create table if not exists public.role_permissions (
  role public.user_role not null,
  permission_id integer not null references public.permissions (id) on delete cascade,
  primary key (role, permission_id)
);

create table if not exists public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  permission_id integer not null references public.permissions (id) on delete cascade,
  granted boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create or replace function public.has_perm(p_module text, p_action text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (
      select o.granted
      from public.user_permission_overrides o
      join public.permissions p on p.id = o.permission_id
      where o.user_id = auth.uid() and p.module = p_module and p.action = p_action
        and (o.expires_at is null or o.expires_at > now())
      order by o.created_at desc
      limit 1
    ),
    exists (
      select 1
      from public.profiles pr
      join public.role_permissions rp on rp.role = pr.role
      join public.permissions p on p.id = rp.permission_id
      where pr.id = auth.uid() and pr.status = 'active'
        and p.module = p_module and p.action = p_action
    )
  );
$$;

-- ---------- Audit log: richer shape + append-only ----------
alter table public.admin_audit_log
  add column if not exists module text,
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists ip text,
  add column if not exists result text not null default 'success';
create index if not exists idx_audit_created on public.admin_audit_log (created_at desc);
create index if not exists idx_audit_actor on public.admin_audit_log (actor_id);
revoke update, delete on public.admin_audit_log from authenticated, anon;

create or replace function public.log_admin_event(
  p_module text, p_action text, p_target_type text default null, p_target_id text default null,
  p_details jsonb default null, p_ip text default null, p_result text default 'success'
) returns void language sql security definer set search_path to 'public' as $$
  insert into public.admin_audit_log (actor_id, module, action, target_type, target_id, details, ip, result)
  values (auth.uid(), p_module, p_action, p_target_type, p_target_id, p_details, p_ip, p_result);
$$;

-- ---------- In-app notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications (user_id, read_at);

create or replace function public.notify_user(p_user_id uuid, p_title text, p_body text default '', p_link text default null)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.notifications (user_id, title, body, link) values (p_user_id, p_title, p_body, p_link);
$$;

-- ---------- Approval workflows ----------
create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('user_create', 'role_change', 'access_request')),
  payload jsonb not null default '{}'::jsonb,
  requested_by uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  comment text,
  created_at timestamptz not null default now()
);

-- ---------- Namespaced app settings (security / AI / data governance) ----------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- ---------- Data governance: GDPR anonymization ----------
create or replace function public.admin_anonymize_user(p_user_id uuid)
returns void language plpgsql security definer set search_path to 'public', 'auth' as $function$
declare
  v_hold boolean;
begin
  if not (public.has_perm('data', 'delete') or public.is_super_admin()) then
    raise exception 'not authorized';
  end if;
  select legal_hold into v_hold from public.profiles where id = p_user_id;
  if v_hold is null then raise exception 'user not found'; end if;
  if v_hold then raise exception 'user is under legal hold — anonymization blocked'; end if;

  update public.profiles set
    full_name = 'Anonymized User',
    email = 'anon-' || left(p_user_id::text, 8) || '@anonymized.local',
    phone = null, job_title = null, department = null, business_unit = null, location = null,
    custom_fields = '{}'::jsonb, employee_id = null, expertise = null, certifications = null,
    status = 'deactivated', anonymized_at = now()
  where id = p_user_id;

  update auth.users set
    email = 'anon-' || left(p_user_id::text, 8) || '@anonymized.local',
    raw_user_meta_data = jsonb_build_object('full_name', 'Anonymized User'),
    encrypted_password = null
  where id = p_user_id;

  insert into public.admin_audit_log (actor_id, module, action, target_type, target_id, details)
  values (auth.uid(), 'data', 'anonymize', 'user', p_user_id::text, jsonb_build_object('gdpr', true));
end;
$function$;

-- ---------- Statuses: allow 'suspended' as well (superset of live behavior) ----------
create or replace function public.admin_set_user_status(p_user_id uuid, p_status text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_role public.user_role;
  v_admin_count int;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('hr_admin', 'org_admin', 'system_admin')) then
    raise exception 'not authorized';
  end if;
  if p_user_id = auth.uid() then raise exception 'use a different admin account to change your own status'; end if;
  if p_status not in ('active', 'suspended', 'deactivated') then raise exception 'invalid status'; end if;

  select role into v_role from public.profiles where id = p_user_id;
  if v_role is null then raise exception 'user not found'; end if;

  if v_role = 'system_admin' and p_status <> 'active' then
    select count(*) into v_admin_count from public.profiles where role = 'system_admin' and status = 'active';
    if v_admin_count <= 1 then raise exception 'cannot deactivate the last remaining super admin'; end if;
  end if;

  update public.profiles set status = p_status where id = p_user_id;

  insert into public.admin_audit_log (actor_id, module, action, target_type, target_id, details)
  values (auth.uid(), 'users', 'status_' || p_status, 'user', p_user_id::text, jsonb_build_object('status', p_status));
end;
$function$;

-- ---------- last_login_at sync from auth ----------
create or replace function public.sync_last_login()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles set last_login_at = new.last_sign_in_at where id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_login on auth.users;
create trigger on_auth_user_login after update of last_sign_in_at on auth.users
  for each row execute function public.sync_last_login();

-- ---------- RLS ----------
alter table public.org_units enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table public.notifications enable row level security;
alter table public.approval_requests enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "org_units read" on public.org_units;
create policy "org_units read" on public.org_units for select to authenticated using (true);
drop policy if exists "org_units write" on public.org_units;
create policy "org_units write" on public.org_units for all to authenticated
  using (public.has_perm('organizations', 'update')) with check (public.has_perm('organizations', 'update'));

drop policy if exists "permissions read" on public.permissions;
create policy "permissions read" on public.permissions for select to authenticated using (true);
drop policy if exists "role_permissions read" on public.role_permissions;
create policy "role_permissions read" on public.role_permissions for select to authenticated using (true);
drop policy if exists "role_permissions write" on public.role_permissions;
create policy "role_permissions write" on public.role_permissions for all to authenticated
  using (public.has_perm('roles', 'update')) with check (public.has_perm('roles', 'update'));

drop policy if exists "overrides read" on public.user_permission_overrides;
create policy "overrides read" on public.user_permission_overrides for select to authenticated
  using (user_id = auth.uid() or public.has_perm('roles', 'view'));
drop policy if exists "overrides write" on public.user_permission_overrides;
create policy "overrides write" on public.user_permission_overrides for all to authenticated
  using (public.has_perm('roles', 'update')) with check (public.has_perm('roles', 'update'));

drop policy if exists "notifications own" on public.notifications;
create policy "notifications own" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications mark read" on public.notifications;
create policy "notifications mark read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "approvals read" on public.approval_requests;
create policy "approvals read" on public.approval_requests for select to authenticated
  using (requested_by = auth.uid() or public.has_perm('users', 'approve'));
drop policy if exists "approvals insert" on public.approval_requests;
create policy "approvals insert" on public.approval_requests for insert to authenticated
  with check (requested_by = auth.uid() and public.is_staff());
drop policy if exists "approvals decide" on public.approval_requests;
create policy "approvals decide" on public.approval_requests for update to authenticated
  using (public.has_perm('users', 'approve')) with check (public.has_perm('users', 'approve'));

drop policy if exists "settings read" on public.app_settings;
create policy "settings read" on public.app_settings for select to authenticated using (public.is_staff());
drop policy if exists "settings write" on public.app_settings;
create policy "settings write" on public.app_settings for all to authenticated
  using (public.has_perm('settings', 'update')) with check (public.has_perm('settings', 'update'));

-- ---------- Seed the permission matrix ----------
insert into public.permissions (module, action)
select m, a from unnest(array['users','roles','organizations','assessments','candidates','reviews','decisions','audit','notifications','settings','ai','data','api']) m
cross join unnest(array['view','create','update','delete','export','approve']) a
on conflict (module, action) do nothing;

do $$
declare
  grant_spec record;
begin
  -- system_admin: everything
  insert into public.role_permissions (role, permission_id)
  select 'system_admin'::public.user_role, id from public.permissions
  on conflict do nothing;

  -- hr_admin & org_admin: everything except roles.update/delete and data.delete
  for grant_spec in
    select r::public.user_role as role, p.id
    from unnest(array['hr_admin', 'org_admin']) r
    cross join public.permissions p
    where not (p.module = 'roles' and p.action in ('update', 'delete'))
      and not (p.module = 'data' and p.action = 'delete')
  loop
    insert into public.role_permissions (role, permission_id) values (grant_spec.role, grant_spec.id) on conflict do nothing;
  end loop;

  -- recruiter
  insert into public.role_permissions (role, permission_id)
  select 'recruiter'::public.user_role, id from public.permissions
  where (module, action) in (
    ('users','view'), ('candidates','view'), ('candidates','create'), ('candidates','update'), ('candidates','export'),
    ('assessments','view'), ('assessments','create'), ('assessments','update'),
    ('reviews','view'), ('reviews','create'), ('decisions','view'), ('notifications','view')
  ) on conflict do nothing;

  -- assessor
  insert into public.role_permissions (role, permission_id)
  select 'assessor'::public.user_role, id from public.permissions
  where (module, action) in (('candidates','view'), ('assessments','view'), ('reviews','view'), ('reviews','create'))
  on conflict do nothing;

  -- hiring_manager and decision_maker
  insert into public.role_permissions (role, permission_id)
  select r::public.user_role, p.id
  from unnest(array['hiring_manager', 'decision_maker']) r
  cross join public.permissions p
  where (p.module, p.action) in (('candidates','view'), ('reviews','view'), ('decisions','view'), ('decisions','create'))
  on conflict do nothing;

  -- client_user: read-only visibility
  insert into public.role_permissions (role, permission_id)
  select 'client_user'::public.user_role, id from public.permissions
  where (module, action) in (('candidates','view'), ('assessments','view'))
  on conflict do nothing;
end $$;

-- Default settings
insert into public.app_settings (key, value) values
  ('security', '{"session_timeout_minutes": 480, "ip_allowlist": [], "mfa_required_roles": []}'::jsonb),
  ('ai', '{"scoring_enabled": true, "allowed_roles": ["hr_admin","org_admin","system_admin"], "monthly_quota": 1000, "model": "claude"}'::jsonb),
  ('data_governance', '{"retention_days": 730, "auto_anonymize": false}'::jsonb)
on conflict (key) do nothing;
