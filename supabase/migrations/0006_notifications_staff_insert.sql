-- notifications had no INSERT policy at all, so any staff-triggered insert
-- (broadcastNotification, and the new assign-existing-user notifications)
-- was silently rejected by RLS. Mirrors the ca_staff_insert pattern already
-- used on candidate_assessments.
create policy "notifications staff insert" on public.notifications
  for insert to authenticated
  with check (is_staff(auth.uid()));
