-- Design-execution-plan Phase 0 / T0.3 -- persist the human-review flag.
--
-- scoreTextResponse() (src/lib/scoring.ts) has always computed a
-- `needsReview` signal -- true whenever the AI (or heuristic fallback)
-- scorer isn't confident a score is right. But the submit action only ever
-- wrote `score` and `ai_rationale` into candidate_responses; the flag was
-- computed and then silently dropped before it reached the database. The
-- human-in-the-loop safeguard the product depends on (AIAC-SRS Part 4) had
-- no data behind it -- there was nothing for a reviewer to see or filter on.
--
-- This adds the missing column so the flag can actually be stored, read
-- back, and surfaced as a visible marker on the candidate report.
alter table public.candidate_responses
  add column if not exists needs_review boolean not null default false;

comment on column public.candidate_responses.needs_review is
  'True when the scoring engine (AI or heuristic fallback) flagged this response as low-confidence and wanting human reviewer confirmation before the score is relied on. Set by scoreTextResponse() in src/lib/scoring.ts at submit time; never set for MCQ responses (deterministically graded in Postgres, always high-confidence).';
