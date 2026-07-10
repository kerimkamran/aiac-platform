-- QA finding: submitReview() (staff/candidates/[id]/actions.ts, shared with
-- decision/candidates/[id]/actions.ts) updates candidate_assessments.status
-- to 'reviewed' after a decision maker submits their review. The only
-- existing UPDATE policy (candidate_id = auth.uid() OR is_staff(auth.uid()))
-- doesn't cover decision makers, so that update was silently a no-op (0
-- rows, no error) whenever a decision_maker -- not staff -- submitted a
-- review: the review itself saved fine, but status never advanced to
-- "reviewed". Mirrors the same is_assigned_decision_maker() scoping already
-- used on the SELECT and candidate_reviews INSERT policies for this table.
drop policy "ca_candidate_update" on public.candidate_assessments;

create policy "ca_candidate_update" on public.candidate_assessments
  for update to authenticated
  using (
    candidate_id = auth.uid()
    or is_staff(auth.uid())
    or is_assigned_decision_maker(id)
  );
