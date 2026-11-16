-- 0022: defect sweep (UAT plan A7). Run AFTER 0019 and 0021. Safe to run twice.
--
--  BLD-B-25  A signed-in user could read the AI provider key from the browser.
--  BLD-B-26  Any staff member could delete tests; only admins may.
--  BLD-X-02  Candidates could edit or delete their own camera recording rows.
--  BLD-B-27  Every signed-in user could list every published test.
--  ADM-A-02  A suspended user with a permission override kept that permission.
--  UX-B-19   Notification links must stay inside the app.
--  ADM-B-22  Recruiters could list the full user directory through the API.

-- BLD-B-25: the app now reads the key on the server with its own key
-- (get_engine_api_key_for_scoring, service role only), after checking can_use_ai().
revoke all on function public.get_engine_api_key(text) from public, anon, authenticated;

-- BLD-B-26: staff may create and edit tests; only HR admins, organisation admins
-- and the super admin may delete them.
drop policy if exists "assessments write" on public.assessments;
drop policy if exists "assessments staff insert" on public.assessments;
drop policy if exists "assessments staff update" on public.assessments;
drop policy if exists "assessments admin delete" on public.assessments;
create policy "assessments staff insert" on public.assessments for insert to authenticated
  with check (public.is_staff());
create policy "assessments staff update" on public.assessments for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "assessments admin delete" on public.assessments for delete to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and status::text = 'active' and role::text in ('hr_admin', 'org_admin', 'system_admin')
  ));

-- BLD-X-02: a candidate may add and read their own recording rows only.
drop policy if exists "proctoring recordings" on public.proctoring_recordings;
drop policy if exists "proctoring recordings read" on public.proctoring_recordings;
drop policy if exists "proctoring recordings insert" on public.proctoring_recordings;
drop policy if exists "proctoring recordings staff write" on public.proctoring_recordings;
create policy "proctoring recordings read" on public.proctoring_recordings for select to authenticated
  using (
    public.is_staff() or exists (
      select 1 from public.candidate_assessments ca
      where ca.id = candidate_assessment_id and ca.candidate_id = auth.uid()
    )
  );
create policy "proctoring recordings insert" on public.proctoring_recordings for insert to authenticated
  with check (
    public.is_staff() or exists (
      select 1 from public.candidate_assessments ca
      where ca.id = candidate_assessment_id and ca.candidate_id = auth.uid()
    )
  );
create policy "proctoring recordings staff write" on public.proctoring_recordings for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "proctoring recordings staff delete" on public.proctoring_recordings for delete to authenticated
  using (public.is_staff());

-- BLD-B-27: a candidate sees only the tests they were assigned (any status).
drop policy if exists "assessments read" on public.assessments;
create policy "assessments read" on public.assessments for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.candidate_assessments ca
      where ca.assessment_id = assessments.id
        and ca.candidate_id = auth.uid()
    )
  );

-- ADM-A-02: an override only counts for an active account.
create or replace function public.has_perm(p_module text, p_action text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case
    when not exists (select 1 from public.profiles where id = auth.uid() and status::text = 'active') then false
    else coalesce(
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
        where pr.id = auth.uid() and pr.status::text = 'active'
          and p.module = p_module and p.action = p_action
      )
    )
  end;
$$;

-- UX-B-19: links in notifications stay inside the app. NOT VALID so existing
-- rows are not rechecked; every new row must comply.
do $$ begin
  alter table public.notifications
    add constraint notifications_link_internal
    check (link is null or (link like '/%' and link not like '//%')) not valid;
exception when duplicate_object then null; end $$;

-- ADM-B-22: recruiters work with candidates (candidates.view), not the whole directory.
delete from public.role_permissions rp
using public.permissions p
where rp.permission_id = p.id and rp.role::text = 'recruiter' and p.module = 'users' and p.action = 'view';
