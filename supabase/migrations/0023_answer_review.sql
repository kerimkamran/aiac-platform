-- 0023: a reviewer can agree with, or change, the score for each answer
-- (UAT plan STF-UX-06 / STF-UX-07). Run after 0022. Safe to run twice.
--
-- score        stays the working score used for the totals. When a reviewer
--              changes it, the score the AI gave is kept in ai_score.
-- reviewed_*   who confirmed the answer and when; confirming clears needs_review.
-- reviewer_note why the score was changed.
alter table public.candidate_responses
  add column if not exists ai_score numeric,
  add column if not exists reviewed_by uuid references public.profiles (id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewer_note text;
