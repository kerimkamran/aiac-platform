# AIAC — AI Assessment Center by AG

Azerconnect Group's competency-based hiring platform. Candidates take structured, competency-mapped
assessments; an AI-assisted engine scores every answer with a written rationale; recruiters review the
evidence and record shortlist / hold / reject decisions — with a human confirming every score
(human-in-the-loop, per AIAC-SRS Part 4).

## Product tour

- **Landing page** (`/`) — marketing page with the competency framework, how-it-works, and role-based CTAs.
- **Candidate portal** (`/candidate`) — dashboard home, guided one-question-at-a-time assessment runner
  (live countdown, autosave to the browser, review-before-submit), and a results area with score ring,
  radar chart, and per-competency bands once a reviewer confirms.
- **Staff portal** (`/staff`) — analytics home (Role Fit distribution, pipeline funnel, review queue),
  searchable/filterable candidate table, evidence-rich review page with radar chart and printable report,
  and an assessment builder mapped to the governed competency dictionary.

## The competency model

37 governed competencies in three categories — **Core** (4, mandatory), **Leadership** (2, mandatory),
**Functional** (31) — each with coded IDs (`CF-C01`…) and Basic / Skilled / Expert behavioural
indicators, seeded by `supabase/seed.sql`. Scores map to four proficiency bands:

| Band | Range |
|---|---|
| Exceeds | 85–100 |
| Fully Meets | 70–84 |
| Partially Meets | 50–69 |
| Does Not Meet | 0–49 |

## Stack

Next.js 16 (App Router, Server Components, Server Actions) · React 19 · Tailwind CSS v4 ·
Supabase (Auth + Postgres with RLS). Charts are hand-rolled SVG — no chart dependency.

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/0001_schema.sql` (tables, RLS policies, auth trigger), then every later
   file in `supabase/migrations/` in order, then `supabase/seed.sql` (37 competencies, demo accounts,
   two published assessments, pre-scored candidate journeys) in the SQL editor.
3. `cp .env.example .env.local` and fill in the project URL + anon key.
4. `npm install && npm run dev`

### Demo accounts (password `Demo12345!`)

| Role | Email |
|---|---|
| HR admin / recruiter | `recruiter@aiac-demo.com` |
| Hiring manager | `manager@aiac-demo.com` |
| Candidate (fresh invitation to take) | `candidate@aiac-demo.com` |

## Scoring notes

- MCQ answers are graded entirely inside Postgres (`submit_mcq_answer()`,
  `supabase/migrations/0012_secure_mcq_scoring.sql`): the correct option is looked up and compared
  server-side and never travels through the Next.js server action or the browser, and each question can
  only be scored once per attempt. This closes the earlier known limitation, where the `options` JSON
  (including the `correct` flag) was readable by any authenticated candidate directly via the Supabase
  API, ahead of answering.
- Free-text answers (`src/lib/scoring.ts`) are scored by the same generation engine (Claude / Sakana Fugu
  / Kimi) configured for assessment generation, graded against the competency's own behavioural
  indicators, with a written rationale for every score. If no engine is configured/enabled, or the AI call
  fails, scoring falls back to a deterministic word-count/keyword heuristic so a candidate's submission is
  never blocked — the rationale always says which path produced the score, and low-confidence scores are
  still flagged for human reviewer confirmation (human-in-the-loop, per AIAC-SRS Part 4).
