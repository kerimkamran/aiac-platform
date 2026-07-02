-- AIAC Platform — Phase 1 schema
-- Mirrors the production project schema: enums, tables (incl. the governed
-- competency dictionary with behavioural indicators), RLS, and the
-- auth -> profile sync trigger. Run before supabase/seed.sql.

create extension if not exists pgcrypto with schema extensions;

-- ---------- Enums ----------

do $$ begin
  create type public.user_role as enum ('candidate', 'recruiter', 'hiring_manager', 'hr_admin', 'system_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assessment_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invitation_status as enum ('invited', 'in_progress', 'submitted', 'scored', 'reviewed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_type as enum ('mcq', 'text', 'coding', 'video', 'rating');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_unit text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id),
  full_name text not null default '',
  email text not null unique,
  role public.user_role not null default 'candidate',
  department text,
  created_at timestamptz not null default now()
);

create table if not exists public.competencies (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null unique,
  category text not null check (category in ('Core', 'Leadership', 'Functional')),
  description text,
  is_mandatory boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.competency_indicators (
  id uuid primary key default gen_random_uuid(),
  competency_id uuid not null references public.competencies (id) on delete cascade,
  level text not null check (level in ('Basic', 'Skilled', 'Expert')),
  indicator_text text not null
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id),
  title text not null,
  description text not null default '',
  status public.assessment_status not null default 'draft',
  time_limit_minutes integer not null default 60,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_sections (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  title text not null,
  sequence integer not null default 1,
  competency_id uuid references public.competencies (id)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.assessment_sections (id) on delete cascade,
  question_type public.question_type not null default 'text',
  prompt text not null,
  options jsonb,
  competency_id uuid references public.competencies (id),
  weight numeric not null default 1,
  sequence integer not null default 1
);

create table if not exists public.candidate_assessments (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  status public.invitation_status not null default 'invited',
  invited_at timestamptz not null default now(),
  started_at timestamptz,
  submitted_at timestamptz,
  overall_score numeric
);

create table if not exists public.candidate_responses (
  id uuid primary key default gen_random_uuid(),
  candidate_assessment_id uuid not null references public.candidate_assessments (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  response_text text,
  selected_option text,
  score numeric,
  ai_rationale text,
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_competency_scores (
  id uuid primary key default gen_random_uuid(),
  candidate_assessment_id uuid not null references public.candidate_assessments (id) on delete cascade,
  competency_id uuid not null references public.competencies (id),
  score numeric not null,
  level text not null
);

create table if not exists public.candidate_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_assessment_id uuid not null references public.candidate_assessments (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id),
  decision text not null check (decision in ('shortlist', 'hold', 'reject')),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_sections_assessment on public.assessment_sections (assessment_id);
create index if not exists idx_questions_section on public.questions (section_id);
create index if not exists idx_indicators_competency on public.competency_indicators (competency_id);
create index if not exists idx_ca_candidate on public.candidate_assessments (candidate_id);
create index if not exists idx_ca_assessment on public.candidate_assessments (assessment_id);
create index if not exists idx_responses_ca on public.candidate_responses (candidate_assessment_id);
create index if not exists idx_scores_ca on public.candidate_competency_scores (candidate_assessment_id);

-- ---------- Auth -> profile sync ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when new.raw_user_meta_data ->> 'role' in ('candidate', 'recruiter', 'hiring_manager', 'hr_admin', 'system_admin')
        then (new.raw_user_meta_data ->> 'role')::public.user_role
      else 'candidate'::public.user_role
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Keep the trigger function off the exposed RPC surface (Supabase lint 0028/0029).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS ----------

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role <> 'candidate'
  );
$$;

-- RLS policies evaluate is_staff() as the querying role, so authenticated keeps
-- EXECUTE; anon does not need it (Supabase lint 0028).
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.competencies enable row level security;
alter table public.competency_indicators enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_sections enable row level security;
alter table public.questions enable row level security;
alter table public.candidate_assessments enable row level security;
alter table public.candidate_responses enable row level security;
alter table public.candidate_competency_scores enable row level security;
alter table public.candidate_reviews enable row level security;

create policy "org read" on public.organizations for select to authenticated using (true);

create policy "profiles: own or staff" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "competencies read" on public.competencies for select to authenticated using (true);
create policy "competencies write" on public.competencies for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "indicators read" on public.competency_indicators for select to authenticated using (true);
create policy "indicators write" on public.competency_indicators for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "assessments read" on public.assessments for select to authenticated using (true);
create policy "assessments write" on public.assessments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "sections read" on public.assessment_sections for select to authenticated using (true);
create policy "sections write" on public.assessment_sections for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "questions read" on public.questions for select to authenticated using (true);
create policy "questions write" on public.questions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "ca: own or staff read" on public.candidate_assessments for select to authenticated
  using (candidate_id = auth.uid() or public.is_staff());
create policy "ca: staff insert" on public.candidate_assessments for insert to authenticated
  with check (public.is_staff());
create policy "ca: own or staff update" on public.candidate_assessments for update to authenticated
  using (candidate_id = auth.uid() or public.is_staff())
  with check (candidate_id = auth.uid() or public.is_staff());

create policy "responses: own or staff read" on public.candidate_responses for select to authenticated
  using (
    public.is_staff() or exists (
      select 1 from public.candidate_assessments ca
      where ca.id = candidate_assessment_id and ca.candidate_id = auth.uid()
    )
  );
create policy "responses: own insert" on public.candidate_responses for insert to authenticated
  with check (
    exists (
      select 1 from public.candidate_assessments ca
      where ca.id = candidate_assessment_id and ca.candidate_id = auth.uid()
    )
  );

create policy "scores: own or staff read" on public.candidate_competency_scores for select to authenticated
  using (
    public.is_staff() or exists (
      select 1 from public.candidate_assessments ca
      where ca.id = candidate_assessment_id and ca.candidate_id = auth.uid()
    )
  );
create policy "scores: own insert" on public.candidate_competency_scores for insert to authenticated
  with check (
    exists (
      select 1 from public.candidate_assessments ca
      where ca.id = candidate_assessment_id and ca.candidate_id = auth.uid()
    )
  );

create policy "reviews: staff all" on public.candidate_reviews for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
