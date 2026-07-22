-- Phase 1+2 improvements: role-profile targets, deadlines/reminders,
-- releasable candidate feedback. Applied live via Supabase MCP on 2026-07-22;
-- this file mirrors that migration for repo parity.

-- 1. Target competency level per assessment section (sections map 1:1 to a
--    competency in generated assessments). Reports compare each candidate
--    competency score against this bar -> meets / below / exceeds.
alter table public.assessment_sections
  add column if not exists target_score numeric
    check (target_score is null or (target_score >= 0 and target_score <= 100));

-- 2. Deadline + reminder bookkeeping on each assigned assessment.
--    due_at: optional deadline set at assignment time.
--    reminder_sent_at: set by the daily cron after it re-sends the invite
--    email ~3 days before the deadline, so each person is reminded once.
--    feedback_released_at: when an admin explicitly released the
--    developmental feedback view to the candidate (Phase 2).
alter table public.candidate_assessments
  add column if not exists due_at timestamptz,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists feedback_released_at timestamptz;
