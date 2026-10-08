-- Phase 0 of the AIAC Assessment Builder plan (trust gaps in today's builder).
--
-- 1. AI engine keys: get_engine_api_key() only checked is_staff(), so
--    recruiters and hiring managers could decrypt provider keys. It now
--    requires can_use_ai(), which reads the AI Governance "allowed_roles"
--    setting (app_settings key 'ai').
-- 2. AI governance enforcement: generation_runs records every generation
--    attempt; its rows drive the monthly quota (ai_runs_this_month()).
-- 3. Publishing: assessments.status can only become 'published' through
--    publish_assessment(), which validates the questions and, for AI drafts,
--    requires an HR/org/system admin and an explicit review confirmation.
--    A trigger blocks every other route (direct update or insert).
-- 4. Drafts are invisible to candidates: assessments/sections RLS and the
--    runner RPCs only expose assessments that are not drafts (candidates who
--    already started or submitted keep access, so nobody is locked out
--    mid-assessment).
-- 5. Candidate-facing text: generated assessments used to carry a description
--    naming the admin and the AI engine. Those are blanked here.

-- ---------------------------------------------------------------------------
-- 1. AI governance helpers and key access
-- ---------------------------------------------------------------------------

create or replace function public.ai_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select value from public.app_settings where key = 'ai'),
    '{"scoring_enabled": true, "allowed_roles": ["hr_admin","org_admin","system_admin"], "monthly_quota": 1000, "model": "claude"}'::jsonb
  );
$$;

create or replace function public.can_use_ai()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status::text = 'active'
      and p.role::text in (select jsonb_array_elements_text(public.ai_settings() -> 'allowed_roles'))
  );
$$;

revoke all on function public.ai_settings() from public, anon;
revoke all on function public.can_use_ai() from public, anon;
grant execute on function public.can_use_ai() to authenticated;

-- Same signature as 0008; only the authorization check changes.
create or replace function public.get_engine_api_key(p_engine_key text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_value text;
begin
  if not public.can_use_ai() then
    raise exception 'not authorized';
  end if;

  select api_key_secret_id into v_secret_id from public.generation_engines where key = p_engine_key;
  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_value from vault.decrypted_secrets where id = v_secret_id;
  return v_value;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Generation runs (audit + monthly quota)
-- ---------------------------------------------------------------------------

create table if not exists public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  engine text not null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  assessment_id uuid references public.assessments (id) on delete set null,
  error text,
  finished_at timestamptz,
  usage jsonb
);

create index if not exists idx_generation_runs_created on public.generation_runs (created_at);

alter table public.generation_runs enable row level security;

drop policy if exists "generation runs read" on public.generation_runs;
create policy "generation runs read" on public.generation_runs for select to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text in ('hr_admin', 'org_admin', 'system_admin'))
  );

drop policy if exists "generation runs insert" on public.generation_runs;
create policy "generation runs insert" on public.generation_runs for insert to authenticated
  with check (created_by = auth.uid() and public.can_use_ai());

-- Status changes go through a definer function so the caller cannot rewrite
-- another run or its usage data.
create or replace function public.finish_generation_run(
  p_run_id uuid,
  p_status text,
  p_assessment_id uuid default null,
  p_error text default null,
  p_usage jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception 'invalid status';
  end if;
  update public.generation_runs
     set status = p_status,
         assessment_id = coalesce(p_assessment_id, assessment_id),
         error = left(p_error, 500),
         usage = p_usage,
         finished_at = now()
   where id = p_run_id and created_by = auth.uid();
end;
$$;

revoke all on function public.finish_generation_run(uuid, text, uuid, text, jsonb) from public, anon;
grant execute on function public.finish_generation_run(uuid, text, uuid, text, jsonb) to authenticated;

-- Organization-wide count for the quota meter and the quota check. Counts
-- every run this month except failed ones, so a broken engine does not burn
-- the quota, but a cut-off or half-saved run still counts as an attempt.
create or replace function public.ai_runs_this_month()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.generation_runs
  where created_at >= date_trunc('month', now())
    and status <> 'failed';
$$;

revoke all on function public.ai_runs_this_month() from public, anon;
grant execute on function public.ai_runs_this_month() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Publish gate
-- ---------------------------------------------------------------------------

alter table public.assessments
  add column if not exists reviewed_by uuid references public.profiles (id),
  add column if not exists reviewed_at timestamptz;

create or replace function public.assessments_publish_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'published' then
      raise exception 'assessments must be created as drafts and published with publish_assessment()';
    end if;
    return new;
  end if;

  if (new.status = 'published' and old.status is distinct from 'published')
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at then
    if coalesce(current_setting('app.publish_via_rpc', true), '') <> 'on' then
      raise exception 'publishing must go through publish_assessment()';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists assessments_publish_guard on public.assessments;
create trigger assessments_publish_guard
  before insert or update on public.assessments
  for each row execute function public.assessments_publish_guard();

create or replace function public.publish_assessment(p_assessment_id uuid, p_reviewed boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_assessment public.assessments%rowtype;
  v_is_ai boolean;
  v_questions integer;
  v_bad integer;
begin
  select p.role::text into v_role
  from public.profiles p
  where p.id = auth.uid() and p.status::text = 'active';

  if v_role is null or v_role not in ('recruiter', 'hiring_manager', 'hr_admin', 'org_admin', 'system_admin') then
    raise exception 'not authorized';
  end if;

  select * into v_assessment from public.assessments where id = p_assessment_id for update;
  if not found then
    raise exception 'assessment not found';
  end if;
  if v_assessment.status = 'archived' then
    raise exception 'restore this assessment to draft before publishing it';
  end if;

  v_is_ai := v_assessment.generated_by is not null;
  if v_is_ai then
    if v_role not in ('hr_admin', 'org_admin', 'system_admin') then
      raise exception 'only an HR admin can publish an AI-generated draft';
    end if;
    if not coalesce(p_reviewed, false) then
      raise exception 'confirm that you reviewed every question before publishing';
    end if;
  end if;

  select count(*) into v_questions
  from public.questions q
  join public.assessment_sections s on s.id = q.section_id
  where s.assessment_id = p_assessment_id;

  if v_questions = 0 then
    raise exception 'add at least one question before publishing';
  end if;

  select count(*) into v_bad
  from public.questions q
  join public.assessment_sections s on s.id = q.section_id
  where s.assessment_id = p_assessment_id
    and q.question_type = 'mcq'
    and (
      q.options is null
      or jsonb_typeof(q.options) <> 'array'
      or jsonb_array_length(q.options) < 2
      or (select count(*) from jsonb_array_elements(q.options) o where (o ->> 'correct')::boolean is true) <> 1
    );

  if v_bad > 0 then
    raise exception '% multiple-choice question(s) need at least 2 options and exactly one correct answer', v_bad;
  end if;

  perform set_config('app.publish_via_rpc', 'on', true);
  update public.assessments
     set status = 'published',
         reviewed_by = case when v_is_ai then auth.uid() else reviewed_by end,
         reviewed_at = case when v_is_ai then now() else reviewed_at end,
         updated_at = now()
   where id = p_assessment_id;
  perform set_config('app.publish_via_rpc', 'off', true);
end;
$$;

revoke all on function public.publish_assessment(uuid, boolean) from public, anon;
grant execute on function public.publish_assessment(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Drafts are invisible to candidates
-- ---------------------------------------------------------------------------

drop policy if exists "assessments read" on public.assessments;
create policy "assessments read" on public.assessments for select to authenticated
  using (
    public.is_staff()
    or status = 'published'
    or exists (
      select 1 from public.candidate_assessments ca
      where ca.assessment_id = assessments.id
        and ca.candidate_id = auth.uid()
        and ca.status <> 'invited'
    )
  );

drop policy if exists "sections read" on public.assessment_sections;
create policy "sections read" on public.assessment_sections for select to authenticated
  using (exists (select 1 from public.assessments a where a.id = assessment_sections.assessment_id));

-- Runner RPCs: same behaviour as 0012, plus a refusal for draft assessments.
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
  join public.assessments a on a.id = ca.assessment_id
  where ca.id = p_candidate_assessment_id
    and (ca.candidate_id = auth.uid() or public.is_staff())
    and a.status <> 'draft';

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
  v_assessment_status public.assessment_status;
  v_options jsonb;
  v_correct_key text;
  v_score numeric;
  v_rationale text;
begin
  select ca.candidate_id, ca.status, a.status
    into v_candidate_id, v_status, v_assessment_status
  from public.candidate_assessments ca
  join public.assessments a on a.id = ca.assessment_id
  where ca.id = p_candidate_assessment_id;

  if v_candidate_id is null or (v_candidate_id <> auth.uid() and not public.is_staff()) then
    raise exception 'not authorized';
  end if;

  if v_assessment_status = 'draft' then
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

-- ---------------------------------------------------------------------------
-- 5. Candidate-facing text cleanup
-- ---------------------------------------------------------------------------
-- Generated assessments used to say "...by <admin name>, via <engine>" in the
-- description, which candidates can see. Blank those; new drafts get a
-- neutral description (see src/app/staff/builder/actions.ts).

update public.assessments
   set description = ''
 where description ilike 'System-generated default assessment%'
    or description ilike 'Generated by % using %';
