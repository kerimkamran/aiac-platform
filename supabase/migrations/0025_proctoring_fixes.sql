-- 0025: proctoring fixes (Batch 26, plan item E-08). Safe to run twice.
--
--  CAN-B-36  0022 already stopped candidates changing or deleting their
--            recording rows. Two gaps remain: a candidate can still read
--            them, and can add rows to an attempt that is already submitted
--            or decided. Rows are integrity evidence, so candidates may only
--            add them, and only while their own attempt is in progress.
--            Staff update/delete policies from 0022 are unchanged.
--
--  Storage   The 'proctoring' bucket had no storage.objects policies in any
--            migration, so uploads from the candidate's browser were refused
--            unless someone added policies by hand in the dashboard. Add
--            owner-insert-only into the candidate's own "<user id>/..."
--            folder (no update, no delete), and staff read/manage (the
--            report page signs URLs, which needs select, and deletes, which
--            needs delete). Also cap file size and allowed types.
--
--  BLD-B-01  The builder showed the camera as "defaulted on" for hiring
--            tests, but nothing was saved until someone pressed Save, and
--            the candidate page only reads what is saved -- so hiring tests
--            ran without the camera. Every assessment now gets a saved row
--            when it is created (on for hiring, off otherwise), so the saved
--            setting is the only truth. Existing tests with no row get one:
--            drafts get the hiring default; tests already published or
--            archived get "off", which is what their candidates actually had.

-- ---------- recording rows ----------
drop policy if exists "proctoring recordings" on public.proctoring_recordings;
drop policy if exists "proctoring recordings read" on public.proctoring_recordings;
create policy "proctoring recordings read" on public.proctoring_recordings for select to authenticated
  using (public.is_staff());

drop policy if exists "proctoring recordings insert" on public.proctoring_recordings;
create policy "proctoring recordings insert" on public.proctoring_recordings for insert to authenticated
  with check (
    public.is_staff() or exists (
      select 1 from public.candidate_assessments ca
      where ca.id = candidate_assessment_id
        and ca.candidate_id = auth.uid()
        and ca.status = 'in_progress'
    )
  );

-- ---------- storage bucket ----------
update storage.buckets
set public = false,
    file_size_limit = 52428800, -- 50 MB per part; a one-minute part is far smaller
    allowed_mime_types = array['video/webm', 'video/mp4']
where id = 'proctoring';

drop policy if exists "proctoring candidate insert own" on storage.objects;
create policy "proctoring candidate insert own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'proctoring'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "proctoring staff read" on storage.objects;
create policy "proctoring staff read" on storage.objects for select to authenticated
  using (bucket_id = 'proctoring' and public.is_staff());

drop policy if exists "proctoring staff manage" on storage.objects;
create policy "proctoring staff manage" on storage.objects for all to authenticated
  using (bucket_id = 'proctoring' and public.is_staff())
  with check (bucket_id = 'proctoring' and public.is_staff());

-- ---------- saved setting for every assessment ----------
create or replace function public.default_proctoring_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.proctoring_settings (assessment_id, camera_enabled, storage_backend)
  values (new.id, coalesce(new.purpose, 'hiring') = 'hiring', 'supabase')
  on conflict (assessment_id) do nothing;
  return new;
end;
$$;

drop trigger if exists assessments_default_proctoring on public.assessments;
create trigger assessments_default_proctoring
  after insert on public.assessments
  for each row execute function public.default_proctoring_settings();

insert into public.proctoring_settings (assessment_id, camera_enabled, storage_backend)
select a.id, (a.status = 'draft' and coalesce(a.purpose, 'hiring') = 'hiring'), 'supabase'
from public.assessments a
where not exists (select 1 from public.proctoring_settings p where p.assessment_id = a.id)
on conflict (assessment_id) do nothing;
