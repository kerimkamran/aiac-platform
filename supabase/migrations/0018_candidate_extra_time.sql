-- Clear Horizon D4: extra time for a candidate.
--
-- HR can give one candidate extra minutes on an assessment (an accommodation,
-- or a technical problem). The exam deadline becomes
--   started_at + (time_limit_minutes + extra_minutes)
-- and the page reads it from here. Safe to run more than once.
--
-- Only staff may change the value. Candidates can already update their own
-- candidate_assessments row (status, started_at), so a trigger stops them from
-- granting themselves time. Service-role and SQL-editor changes (no signed-in
-- user) are allowed.

alter table public.candidate_assessments
  add column if not exists extra_minutes integer not null default 0;

do $$
begin
  alter table public.candidate_assessments
    add constraint candidate_assessments_extra_minutes_range check (extra_minutes between 0 and 240);
exception
  when duplicate_object then null;
end $$;

create or replace function public.guard_extra_minutes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.extra_minutes is distinct from old.extra_minutes
     and auth.uid() is not null
     and not public.is_staff(auth.uid()) then
    raise exception 'Only staff can change extra time' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists ca_guard_extra_minutes on public.candidate_assessments;
create trigger ca_guard_extra_minutes
  before update on public.candidate_assessments
  for each row execute function public.guard_extra_minutes();
