-- Manager sign-off step for promotion assessments.
--
-- The reviewer decision on a promotion assessment (Recommend / Needs
-- Development Plan / Not Yet Ready) is made by HR/staff, but a promotion
-- decision typically also wants the employee's own manager to weigh in.
-- This table is a lightweight, optional sign-off request/response attached
-- to a specific candidate_assessment -- not a blocking gate, since not every
-- org wants a hard approval step, but a place to capture the manager's
-- input and surface it alongside the HR decision.
--
-- Applied live via Supabase migration v12_promotion_manager_signoff; this
-- commit adds the matching migration file for repo parity.

create table if not exists public.promotion_signoffs (
  id uuid primary key default gen_random_uuid(),
  candidate_assessment_id uuid not null references public.candidate_assessments(id) on delete cascade,
  requested_by uuid references public.profiles(id),
  manager_id uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  comment text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists promotion_signoffs_ca_idx on public.promotion_signoffs(candidate_assessment_id);
create index if not exists promotion_signoffs_manager_idx on public.promotion_signoffs(manager_id);

alter table public.promotion_signoffs enable row level security;

create policy "signoffs staff all" on public.promotion_signoffs
  for all to authenticated using (is_staff(auth.uid())) with check (is_staff(auth.uid()));

create policy "signoffs manager read own" on public.promotion_signoffs
  for select to authenticated using (manager_id = auth.uid());

create policy "signoffs manager decide own" on public.promotion_signoffs
  for update to authenticated using (manager_id = auth.uid()) with check (manager_id = auth.uid());
