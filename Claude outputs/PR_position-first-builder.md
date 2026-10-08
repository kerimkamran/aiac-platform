# Position-first assessment builder (Phases 0, 1 and 2)

Implements the AIAC Assessment Builder Simplification Plan. Branch `feat/position-first-builder`, based on `main` (f3bd64e). Four commits: Phase 0 trust fixes, Phase 1 position-first builder, Phase 2 review and reuse, and a gap-closing commit (`e53fb4b`) that finishes the remaining plan items.

## What changes for admins

- **New assessment** page replaces the side panel. Pick a position (or type a new one) and one or more of five levels. One draft is created per position and level; untick combinations that don't apply (up to 6 per batch).
- **Help the AI understand the role**: shared instructions with starter phrases, job description (paste, or upload .md / .txt / .docx), notes, and up to 3 reference files per position. Saved per position, so the next assessment starts pre-filled. One-off files apply to a batch and are not saved.
- **Positions** library: list, create, edit, reference files, archive.
- **Draft page**: a brief card (position, level, purpose, language, context sent, anything trimmed or redacted); inline question editing with a correct-answer radio; "Replace with a new question" with an optional note; publish checklist; "New from this position", "Make an exact copy", and Azerbaijani / Russian versions.
- **Lock**: once a candidate starts an attempt, questions cannot be added, changed, moved or replaced.
- **AI Governance**: per-engine switch for whether job descriptions and files may be sent (Claude on by default).

## Phase 0: trust fixes

- Engine keys: `get_engine_api_key` requires `can_use_ai()` (roles from AI Governance), not just `is_staff()`.
- AI Governance is enforced in one place (`src/lib/ai-policy.ts`): enabled flag, allowed roles, default engine, monthly quota counted from `generation_runs`.
- Only published assessments can be assigned, listed to candidates, or started (DB and app).
- Publish goes through `publish_assessment()`: at least one question, every MCQ has exactly one correct answer, AI drafts need an HR/org/system admin and the "I reviewed every question" tick. A trigger blocks direct status updates.
- Generation: higher output limit, cut-off detection, invalid questions dropped and counted (never repaired), options shuffled.
- Candidate-facing text: no auto descriptions naming the admin or engine; the chosen language is saved.
- Redaction: emails and phone numbers, including +994 and 0XX formats; counts are shown to staff.

## Phase 1: position-first builder

- Levels (`src/lib/levels.ts`): five tiers with scenario guidance, indicator emphasis, pass marks (60 / 70 / 70 / 75 / 80, **pending HR sign-off**) and scoring bars. Every indicator is still sent, tagged target or reference for the level.
- Context (`src/lib/ai-context.ts`): hidden HTML comments and zero-width characters removed; our delimiters stripped; personal data redacted; budget of 20,000 characters, with reference files trimmed first, then the job description. Instructions and notes are rejected when too long rather than cut silently. Context is wrapped as information only.
- Consent: context is sent only to engines with `allow_context`. The server reads that through `engine_policy_for_staff()` so recruiters see engine state without reading the admin-only table.
- Scoring is calibrated to the assessment's level (`levelCalibration`).
- Each generation attempt is recorded in `generation_runs` with batch and idempotency keys; a retried draft cannot be generated twice; a failed draft is removed rather than left half-built.
- Core competencies pre-select six, leaving room for Leadership. Choosing a manager-or-above level adds up to two Leadership competencies once; the reviewer's own choices after that are never changed. Leadership competencies are filtered out for Entry and Senior drafts on the server.
- Advanced section: optional custom title (applies to a single draft; a batch keeps position and level as titles) and an engine override.

## Phase 2: review and reuse

- Inline edit and correct-answer radio (`updateQuestion`).
- Regenerate one question (`regenerateOneQuestion`); the reply must be exactly one question of the same type; counted against the quota.
- Translation (`createTranslatedVersion`): same questions, option order and correct answers. Output is validated before saving. The copy is a new AI draft and needs its own review.
- Publish checklist dialog on both the draft page and the preview page. Blocking items disable Publish; warnings do not. The checks live in one shared helper (`src/lib/publish-checks.ts`). The database enforces the same rules again.
- Duplicate keeps position, level, vacancy and the AI-draft flag. Previously `generated_by` was dropped, which bypassed the review requirement.
- Proctoring card moved below the questions.

## Migrations

- `0013_trust_gaps.sql`: Phase 0.
- `0014_position_builder.sql`: positions, position files, assessment and generation-run columns, `allow_context`, `engine_policy_for_staff()`.
- `0015_review_locks.sql`: `assessment_is_locked()` and the `questions_lock_guard` trigger (insert and update only; whole-assessment deletes still cascade).

The plan named the Phase 1 migration `0013_position_builder.sql`; it is `0014` here because `0013` was the Phase 0 migration.

## Deviations from the plan

- **Short** is 10 questions, not ~8. The generator treats 10 as a hard minimum.
- **Core** pre-selects six competencies (not "always included"). Leadership is added once per manager-or-above level choice, and never overrides the reviewer's own selection.
- Indicators are tagged target / reference instead of being filtered (see the plan's own note on sparse indicators).

## Verification

- `tsc --noEmit`: clean on `e53fb4b`.
- `vitest`: 54 tests passing across 11 files on `e53fb4b`. New coverage: context preparation and redaction, level calibration in scoring, regenerate and translate validation with a mocked engine, upload text checks.
- `eslint`: no errors. Two pre-existing unused-variable warnings in `builder/actions.ts` (`_omit`, `_omit2`) remain from `main`.
- `next build --webpack`: passed before the gap-closing commit. Google Fonts were mocked because the sandbox has no access to them. Turbopack build not run.
- `pglast`: migrations 0013 to 0015 parse.
- **Not run against a live Postgres.** RLS, the publish trigger, the lock trigger and the RPCs need a database test before merge.
- **Not checked in a browser.** Keyboard, mobile and screen-reader behaviour of the new position picker, Advanced section and publish dialog still need a manual pass.

## Test plan (manual, against a staging database)

1. Apply 0013, 0014 and 0015 in order. Confirm `engine_policy_for_staff()` returns rows for a recruiter.
2. As a recruiter: `Create position`, upload a .docx job description, reopen the position and confirm it is pre-filled.
3. Generate Manager and Director drafts for one position. Confirm two drafts, correct vacancy and level, pass marks 70 and 75, the brief card shows the context sent, and Leadership competencies were added once.
4. Try to generate with Claude's allow-context switched off in AI Governance. Confirm no job description is sent and the warning appears.
5. Publish an AI draft without the review tick (the button stays disabled), on both the draft page and the preview page. Publish with the tick.
6. Start one candidate attempt. Confirm the draft shows the lock message and editing is refused, including direct database writes.
7. Create an Azerbaijani version and check that candidate-facing text is in Azerbaijani and correct answers match the source.
8. Duplicate an AI draft and confirm the copy still requires review before publishing.
9. Enter a custom title on a single-draft generation and confirm it is used; on a batch, confirm position and level are the titles.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
