-- 0005: Fix two RBAC gaps found in a health-check review of 0004_admin.
--
-- 1. is_staff() was never widened to include the new 'org_admin' role, even
--    though the app already treats org_admin as an admin-tier role (see
--    ADMIN_ROLES in src/lib/authz.ts and isAdmin in staff/layout.tsx). Without
--    this, an org_admin would be silently denied by RLS on tables gated by
--    is_staff() (email_templates, candidate_decision_makers, generation_engines,
--    proctoring_settings, case_library, admin_audit_log) despite the UI
--    showing them as an admin.
-- 2. The admin_audit_log "audit staff read" policy let ANY staff member
--    (including a plain recruiter) read the full audit trail -- logins, IPs,
--    role changes, GDPR anonymization events. Narrowed to admin roles only,
--    matching the /admin/audit page's own ADMIN_ROLES gate.

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('recruiter','hiring_manager','hr_admin','org_admin','system_admin')
  );
$$;

create or replace function public.is_staff(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from profiles p where p.id = uid and p.role in ('recruiter','hiring_manager','hr_admin','org_admin','system_admin')
  );
$$;

drop policy if exists "audit staff read" on public.admin_audit_log;
create policy "audit staff read" on public.admin_audit_log for select to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('hr_admin', 'org_admin', 'system_admin')
  ));
