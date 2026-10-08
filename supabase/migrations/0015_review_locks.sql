-- Phase 2 of the AIAC Assessment Builder plan: review and reuse.
--
-- Locking: once any candidate has started an attempt, the questions of that
-- assessment can no longer be added or changed. The rule lives in the database
-- so no server action can bypass it. Deleting a whole assessment still works
-- (admins can remove an assessment and its results), so the guard covers
-- inserts and updates only; individual deletes are also refused in the app.

create or replace function public.assessment_is_locked(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    and exists (
      select 1 from public.candidate_assessments ca
      where ca.assessment_id = p_assessment_id
        and ca.status <> 'invited'
    );
$$;

revoke all on function public.assessment_is_locked(uuid) from public;
grant execute on function public.assessment_is_locked(uuid) to authenticated;

create or replace function public.guard_question_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment uuid;
begin
  select s.assessment_id into v_assessment
  from public.assessment_sections s
  where s.id = new.section_id;

  if v_assessment is not null and exists (
    select 1 from public.candidate_assessments ca
    where ca.assessment_id = v_assessment
      and ca.status <> 'invited'
  ) then
    raise exception 'Candidates have started this assessment, so its questions are locked. Make a copy to change them.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists questions_lock_guard on public.questions;
create trigger questions_lock_guard
  before insert or update on public.questions
  for each row execute function public.guard_question_lock();
