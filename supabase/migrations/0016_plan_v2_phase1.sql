-- Development plan v2, Phase 1 (remove and simplify) and the drift fixes.
--
-- Migrations only in this phase: nothing is dropped. The positions, position
-- files, chat and case-library tables stay in place for one release, so the
-- data can be checked before any drop (see plan section 8 and Appendix A).
--
-- 1. Drift: the app writes the eight purpose-aware review decisions
--    (src/lib/purpose.ts), but candidate_reviews only allowed shortlist, hold
--    and reject. Reviews for promotion and development were failing silently.
-- 2. Positions -> "Job title / vacancy": copy each position title into
--    assessments.vacancy_title where the assessment has none.
-- 3. Section and question deletes are refused once a candidate has started
--    the assessment (plan section 9, item 1). The 0015 guard covers inserts
--    and updates; this adds the delete guard for sections and questions.
--    Deleting a whole assessment still works: its cascade is allowed.
-- 4. Archive remembers the status it came from, so restoring a published
--    assessment brings it back as published (plan section 9, item 4).

-- ---------------------------------------------------------------------------
-- 1. Review decision vocabulary
-- ---------------------------------------------------------------------------

alter table public.candidate_reviews
  drop constraint if exists candidate_reviews_decision_check;

alter table public.candidate_reviews
  add constraint candidate_reviews_decision_check
  check (decision in (
    'shortlist', 'hold', 'reject',
    'recommend', 'needs_development_plan', 'not_yet_ready',
    'strengths_identified', 'growth_areas_identified'
  ));

-- ---------------------------------------------------------------------------
-- 2. Positions become a job-title field on the assessment
-- ---------------------------------------------------------------------------

update public.assessments a
set vacancy_title = p.title
from public.positions p
where a.position_id = p.id
  and (a.vacancy_title is null or btrim(a.vacancy_title) = '');

-- ---------------------------------------------------------------------------
-- 3. Delete guard for sections and questions on a started assessment
-- ---------------------------------------------------------------------------

create or replace function public.guard_delete_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment uuid;
begin
  -- Deletes that cascade from removing the whole assessment run at trigger
  -- depth > 1 and are allowed: admins may remove an assessment and its results.
  if pg_trigger_depth() > 1 then
    return old;
  end if;

  if tg_table_name = 'assessment_sections' then
    v_assessment := old.assessment_id;
  else
    select s.assessment_id into v_assessment
    from public.assessment_sections s
    where s.id = old.section_id;
  end if;

  if v_assessment is not null and exists (
    select 1 from public.candidate_assessments ca
    where ca.assessment_id = v_assessment
      and ca.status <> 'invited'
  ) then
    raise exception 'Candidates have started this assessment, so its sections and questions are locked. Make a copy to change them.'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists questions_delete_lock on public.questions;
create trigger questions_delete_lock
  before delete on public.questions
  for each row execute function public.guard_delete_lock();

drop trigger if exists assessment_sections_delete_lock on public.assessment_sections;
create trigger assessment_sections_delete_lock
  before delete on public.assessment_sections
  for each row execute function public.guard_delete_lock();

-- ---------------------------------------------------------------------------
-- 4. Archive remembers the previous status; restore goes back to it
-- ---------------------------------------------------------------------------

alter table public.assessments
  add column if not exists previous_status text;

-- Any route that archives an assessment records where it came from.
create or replace function public.remember_previous_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'archived' and old.status is distinct from 'archived' then
    new.previous_status := old.status::text;
  end if;
  return new;
end;
$$;

drop trigger if exists assessments_remember_previous_status on public.assessments;
create trigger assessments_remember_previous_status
  before update on public.assessments
  for each row execute function public.remember_previous_status();

-- Restoring a published assessment has to pass the publish guard from 0013,
-- so the RPC sets the same local flag publish_assessment() sets. Restoring
-- anything else returns it to draft, as before.
create or replace function public.restore_archived_assessment(p_assessment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_previous text;
begin
  select p.role::text into v_role
  from public.profiles p
  where p.id = auth.uid() and p.status::text = 'active';

  if v_role is null or v_role not in ('recruiter', 'hiring_manager', 'hr_admin', 'org_admin', 'system_admin') then
    raise exception 'not authorized';
  end if;

  select a.previous_status into v_previous
  from public.assessments a
  where a.id = p_assessment_id and a.status = 'archived'
  for update;
  if not found then
    raise exception 'this assessment is not archived';
  end if;

  if v_previous = 'published' then
    perform set_config('app.publish_via_rpc', 'on', true);
    update public.assessments
      set status = 'published', previous_status = null
      where id = p_assessment_id;
    perform set_config('app.publish_via_rpc', '', true);
  else
    update public.assessments
      set status = 'draft', previous_status = null
      where id = p_assessment_id;
  end if;
end;
$$;

revoke all on function public.restore_archived_assessment(uuid) from public;
grant execute on function public.restore_archived_assessment(uuid) to authenticated;
