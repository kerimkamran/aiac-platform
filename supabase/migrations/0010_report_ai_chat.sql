-- Feature: "Discuss with AI" side panel on a candidate's report (staff +
-- decision makers only, per request). Chat threads are grounded in that
-- specific candidate_assessment's report data (scores, competency
-- breakdown, response rationale) and persisted so a reviewer can leave and
-- come back to the same conversation. Uses the existing Kimi engine via
-- generation_engines / get_engine_api_key() -- no new secret-storage
-- mechanism needed.

create table if not exists public.report_ai_threads (
  id uuid primary key default gen_random_uuid(),
  candidate_assessment_id uuid not null references public.candidate_assessments(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.report_ai_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists report_ai_threads_ca_idx on public.report_ai_threads(candidate_assessment_id);
create index if not exists report_ai_messages_thread_idx on public.report_ai_messages(thread_id, created_at);

alter table public.report_ai_threads enable row level security;
alter table public.report_ai_messages enable row level security;

-- Staff-only (is_staff() already excludes 'candidate') further scoped so a
-- decision maker only sees threads on candidate_assessments they're
-- actually assigned to -- mirrors the same is_assigned_decision_maker()
-- pattern used for candidate_assessments/candidate_reviews access.
create policy "report_ai_threads: staff or assigned dm" on public.report_ai_threads
  for all to authenticated
  using (
    public.is_staff()
    and (
      not exists (select 1 from public.profiles where id = auth.uid() and role = 'decision_maker')
      or public.is_assigned_decision_maker(candidate_assessment_id)
    )
  )
  with check (
    public.is_staff()
    and (
      not exists (select 1 from public.profiles where id = auth.uid() and role = 'decision_maker')
      or public.is_assigned_decision_maker(candidate_assessment_id)
    )
  );

create policy "report_ai_messages: via parent thread" on public.report_ai_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.report_ai_threads t
      where t.id = thread_id
        and public.is_staff()
        and (
          not exists (select 1 from public.profiles where id = auth.uid() and role = 'decision_maker')
          or public.is_assigned_decision_maker(t.candidate_assessment_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.report_ai_threads t
      where t.id = thread_id
        and public.is_staff()
        and (
          not exists (select 1 from public.profiles where id = auth.uid() and role = 'decision_maker')
          or public.is_assigned_decision_maker(t.candidate_assessment_id)
        )
    )
  );
