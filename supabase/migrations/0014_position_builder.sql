-- Phase 1 of the AIAC Assessment Builder plan: position-first assessments.
--
-- A position (e.g. "Key Account Manager") keeps its job description, notes,
-- shared instructions and reference files, so the next assessment for it
-- starts pre-filled. Assessments remember which position and level they were
-- written for. Each AI generation run is recorded with a batch and an
-- idempotency key, so a retried draft cannot be generated twice.
--
-- Access: staff (is_staff) can read and write positions and their files;
-- candidates never can. Only engines an admin has approved for context
-- (generation_engines.allow_context) receive job descriptions or files.

-- ---------------------------------------------------------------------------
-- Positions and their reference material
-- ---------------------------------------------------------------------------

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id),
  title text not null check (char_length(trim(title)) between 2 and 120),
  department text,
  default_level text not null default 'manager'
    check (default_level in ('entry', 'senior', 'manager', 'director', 'c_level')),
  job_description text not null default '',
  instructions text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists positions_title_active
  on public.positions (lower(title))
  where archived_at is null;

create table if not exists public.position_files (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.positions (id) on delete cascade,
  filename text not null check (char_length(filename) between 1 and 120),
  content_text text not null,
  size_bytes integer not null check (size_bytes >= 0),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_position_files_position on public.position_files (position_id);

alter table public.positions enable row level security;
alter table public.position_files enable row level security;

drop policy if exists "positions staff read" on public.positions;
create policy "positions staff read" on public.positions for select to authenticated
  using (public.is_staff());

drop policy if exists "positions staff write" on public.positions;
create policy "positions staff write" on public.positions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "position files staff read" on public.position_files;
create policy "position files staff read" on public.position_files for select to authenticated
  using (public.is_staff());

drop policy if exists "position files staff write" on public.position_files;
create policy "position files staff write" on public.position_files for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Assessments remember their position and level
-- ---------------------------------------------------------------------------

alter table public.assessments
  add column if not exists position_id uuid references public.positions (id) on delete set null,
  add column if not exists target_level text
    check (target_level in ('entry', 'senior', 'manager', 'director', 'c_level'));

create index if not exists idx_assessments_position on public.assessments (position_id);

-- ---------------------------------------------------------------------------
-- Generation runs: batch, idempotency and what context was used (metadata only)
-- ---------------------------------------------------------------------------

alter table public.generation_runs
  add column if not exists position_id uuid references public.positions (id) on delete set null,
  add column if not exists batch_id uuid,
  add column if not exists idempotency_key text,
  add column if not exists target_level text
    check (target_level in ('entry', 'senior', 'manager', 'director', 'c_level')),
  add column if not exists prompt_version text,
  add column if not exists context_snapshot jsonb;

create unique index if not exists generation_runs_idempotency
  on public.generation_runs (created_by, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- Context consent per engine
-- ---------------------------------------------------------------------------

alter table public.generation_engines
  add column if not exists allow_context boolean not null default false;

-- Claude is the approved engine for job descriptions by default; the others
-- stay off until a system admin turns them on in AI Governance.
update public.generation_engines set allow_context = true where key = 'claude';

-- ---------------------------------------------------------------------------
-- Engine status for staff. generation_engines is readable by admins only
-- (engines admin policy), so recruiters could not see whether an engine was
-- on, or whether it may receive context. This returns the non-secret fields
-- to any active staff member. The API key itself is never returned.
-- ---------------------------------------------------------------------------

create or replace function public.engine_policy_for_staff()
returns table (
  key text,
  display_name text,
  enabled boolean,
  configured boolean,
  allow_context boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select e.key, e.display_name, e.enabled, (e.api_key_secret_id is not null), e.allow_context
  from public.generation_engines e
  where public.is_staff();
$$;

revoke all on function public.engine_policy_for_staff() from public;
grant execute on function public.engine_policy_for_staff() to authenticated;
