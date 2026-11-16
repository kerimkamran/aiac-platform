-- Exam integrity, phase 1 (Vantage UAT plan, A5: E-04, E-05, E-06). Safe to run twice.
-- Run after 0019.
--
--   E-04  The server notes when a submission arrives after the time limit.
--   E-05  Answers are saved on the server while the candidate works, so an
--         expired attempt can be closed with what was written.
--   E-06  The due date only stops people STARTING. Someone already in progress
--         keeps their full time.

alter table public.candidate_assessments
  add column if not exists draft_answers jsonb,
  add column if not exists draft_saved_at timestamptz,
  add column if not exists submitted_late boolean not null default false;

-- Saves the candidate's answers so far (question id -> text or option key).
create or replace function public.save_attempt_draft(p_candidate_assessment_id uuid, p_answers jsonb)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_row public.candidate_assessments%rowtype;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 400000 then
    raise exception 'invalid draft';
  end if;

  select * into v_row from public.candidate_assessments
  where id = p_candidate_assessment_id for update;

  if not found or v_row.candidate_id <> auth.uid() then
    raise exception 'not authorized';
  end if;
  if v_row.status <> 'in_progress' then
    return v_row.draft_saved_at;
  end if;

  update public.candidate_assessments
     set draft_answers = p_answers, draft_saved_at = now()
   where id = v_row.id;
  return now();
end;
$$;
revoke all on function public.save_attempt_draft(uuid, jsonb) from public, anon;
grant execute on function public.save_attempt_draft(uuid, jsonb) to authenticated;

-- E-06: the due date applies to starting only.
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
    if v_row.due_at is not null and v_row.due_at < now() then
      raise exception 'the deadline for this assessment has passed';
    end if;
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

-- E-04: flag a submission that arrives after the time limit plus a two-minute
-- allowance for slow networks. It is never refused: the candidate's work is kept.
create or replace function public.begin_submit(p_candidate_assessment_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_row public.candidate_assessments%rowtype;
  v_limit integer;
  v_late boolean := false;
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
    if v_row.started_at is not null then
      select coalesce(a.time_limit_minutes, 60) into v_limit
      from public.assessments a where a.id = v_row.assessment_id;
      v_late := now() > v_row.started_at
        + make_interval(mins => coalesce(v_limit, 60) + coalesce(v_row.extra_minutes, 0) + 2);
    end if;
    update public.candidate_assessments
       set status = 'submitted', submitted_at = now(), submitted_late = v_late
     where id = v_row.id;
  end if;
  return v_row.status::text;
end;
$$;
revoke all on function public.begin_submit(uuid) from public, anon;
grant execute on function public.begin_submit(uuid) to authenticated;

-- The app now grades multiple-choice answers on the server. The candidate-callable
-- grader is no longer needed and would let someone "peek" at a question's key.
revoke execute on function public.submit_mcq_answer(uuid, uuid, text) from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- E-10: a manager sees their sign-off requests, with names, whatever their role
-- ---------------------------------------------------------------------------
-- The manager has no right to read the employee's assessment row, so the names
-- came back blank. This function returns only the manager's own requests and
-- the employee's name and test title.

create or replace function public.my_signoff_requests()
returns table (
  id uuid, status text, comment text, requested_at timestamptz, decided_at timestamptz,
  candidate_assessment_id uuid, candidate_name text, assessment_title text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.status, s.comment, s.requested_at, s.decided_at,
         s.candidate_assessment_id, p.full_name, a.title
  from public.promotion_signoffs s
  join public.candidate_assessments ca on ca.id = s.candidate_assessment_id
  join public.profiles p on p.id = ca.candidate_id
  join public.assessments a on a.id = ca.assessment_id
  where s.manager_id = auth.uid()
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.status::text = 'active')
  order by s.requested_at desc;
$$;
revoke all on function public.my_signoff_requests() from public, anon;
grant execute on function public.my_signoff_requests() to authenticated;
