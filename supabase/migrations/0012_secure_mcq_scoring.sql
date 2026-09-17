-- Security fix (known limitation from the Phase-1 README): the "questions
-- read" policy let ANY authenticated user -- including a candidate mid-way
-- through their own assessment -- select every column of public.questions
-- directly via the Supabase client, and options jsonb carries each MCQ
-- option's `correct` flag. The Next.js runner page already stripped
-- `correct` before rendering (src/app/candidate/assessments/[id]/page.tsx),
-- but that only protects the server-rendered payload: a candidate could
-- still call `supabase.from('questions').select('*')` straight from the
-- browser console (the anon-key client is already bundled for other
-- features -- see src/app/candidate/assessments/[id]/proctoring-gate.tsx)
-- and read the correct answer to any MCQ, in any assessment, ahead of time.
--
-- RLS can restrict which *rows* a role sees, not which *keys* inside a
-- jsonb column -- and staff and candidates share the same `authenticated`
-- Postgres role, so a column-level GRANT/REVOKE can't separate them either.
-- The fix used elsewhere in this schema for exactly this shape of problem
-- (see 0008_encrypt_generation_engine_keys.sql) is a narrow SECURITY
-- DEFINER function that does its own authorization and only ever returns
-- the safe shape. Two are added here:
--
--   get_runner_questions(p_candidate_assessment_id) -- replaces the direct
--     assessment_sections/questions select used to render the assessment
--     UI (and to enumerate questions for scoring). Options never include
--     `correct`, regardless of caller.
--
--   submit_mcq_answer(p_candidate_assessment_id, p_question_id,
--     p_selected_key) -- grades one MCQ answer entirely inside Postgres.
--     The correct key is looked up and compared server-side and never
--     returned to the caller; only score/rationale/needs_review come back,
--     and the rationale only ever names the correct key *after* the
--     candidate's response for that question has already been recorded
--     (one row per question, enforced below), so calling this ahead of a
--     real submit to "peek" just locks in a wrong, unchangeable answer for
--     that question instead of leaking anything useful.
--
-- The base `questions` table is restricted to staff; both functions are
-- SECURITY DEFINER so they can still read it internally for an owning
-- candidate.

-- One scored response per question per assessment attempt -- also what
-- makes submit_mcq_answer's one-shot guarantee possible.
do $$ begin
  alter table public.candidate_responses
    add constraint candidate_responses_unique_question unique (candidate_assessment_id, question_id);
exception when duplicate_object then null; end $$;

drop policy if exists "questions read" on public.questions;
create policy "questions read" on public.questions for select to authenticated
  using (public.is_staff());

create or replace function public.get_runner_questions(p_candidate_assessment_id uuid)
returns table (
  section_id uuid,
  section_title text,
  section_sequence int,
  section_competency_id uuid,
  question_id uuid,
  question_type public.question_type,
  prompt text,
  question_sequence int,
  weight numeric,
  question_competency_id uuid,
  options jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment_id uuid;
begin
  select ca.assessment_id into v_assessment_id
  from public.candidate_assessments ca
  where ca.id = p_candidate_assessment_id
    and (ca.candidate_id = auth.uid() or public.is_staff());

  if v_assessment_id is null then
    raise exception 'not authorized';
  end if;

  return query
  select
    s.id, s.title, s.sequence, s.competency_id,
    q.id, q.question_type, q.prompt, q.sequence, q.weight, q.competency_id,
    case
      when q.options is null then null
      else (
        select jsonb_agg(jsonb_build_object('key', t.elem ->> 'key', 'text', t.elem ->> 'text') order by t.ord)
        from jsonb_array_elements(q.options) with ordinality as t(elem, ord)
      )
    end
  from public.assessment_sections s
  join public.questions q on q.section_id = s.id
  where s.assessment_id = v_assessment_id
  order by s.sequence, q.sequence;
end;
$$;

revoke all on function public.get_runner_questions(uuid) from public;
grant execute on function public.get_runner_questions(uuid) to authenticated;

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

  if v_status not in ('invited', 'in_progress') then
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

-- Real AI text scoring (see src/lib/scoring.ts) needs the same generation
-- engine credentials as assessment generation, but from a candidate's own
-- submit action -- get_engine_api_key() is deliberately staff-only
-- (0008_encrypt_generation_engine_keys.sql) and must stay that way. This
-- mirrors the existing get_engine_api_key_for_scout() boundary used by
-- src/lib/scout-actions.ts: no role check in the function body (a
-- candidate legitimately triggers scoring of their own submission), but
-- revoked from anon/authenticated at the grant level so it is reachable
-- only through the service-role client (src/lib/supabase/admin.ts), never
-- directly from a browser session -- which would otherwise hand out the
-- raw provider API key on request.
create or replace function public.get_engine_api_key_for_scoring(p_engine_key text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_enabled boolean;
  v_value text;
begin
  select api_key_secret_id, enabled into v_secret_id, v_enabled
  from public.generation_engines where key = p_engine_key;

  if v_secret_id is null or not coalesce(v_enabled, false) then
    return null;
  end if;

  select decrypted_secret into v_value from vault.decrypted_secrets where id = v_secret_id;
  return v_value;
end;
$$;

revoke all on function public.get_engine_api_key_for_scoring(text) from public, anon, authenticated;
