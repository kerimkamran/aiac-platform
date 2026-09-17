// Phase-2 scoring engine.
//
// MCQ scoring no longer lives here -- it's graded entirely inside Postgres
// (see submit_mcq_answer() in supabase/migrations/0012_secure_mcq_scoring.sql)
// so the correct option never has to travel through this server-side code,
// closing the leak the Phase-1 README flagged ("MCQ options JSON, including
// the correct flag, readable by authenticated candidates via the API").
//
// Free-text scoring is now real LLM-based grading (AIAC-SRS Part 4's
// Product Vision), reusing the same generation-engine credentials
// (Claude/Sakana Fugu/Kimi) already configured for assessment generation --
// see src/lib/generation.ts and get_engine_api_key_for_scoring() in the
// migration above. If no engine is configured/enabled, or the call fails
// for any reason, scoring falls back to the original deterministic
// heuristic rather than blocking the candidate's submission -- every
// heuristic rationale still says so, and low-confidence scores are still
// flagged for human reviewer confirmation (human-in-the-loop, Part 4).

import { extractJson } from "./generation";

export type ScoreResult = { score: number; rationale: string; needsReview: boolean };

export type CompetencyContext = {
  name: string;
  description: string | null;
  indicators: { level: string; indicator_text: string }[];
};

export type ScoringEngine = "claude" | "fugu" | "kimi";

const OUTCOME_SIGNALS = [
  "result",
  "achiev",
  "improv",
  "increas",
  "reduc",
  "success",
  "impact",
  "outcome",
  "deliver",
];

const ACTION_SIGNALS = [
  "led",
  "implement",
  "develop",
  "organiz",
  "initiat",
  "collaborat",
  "resolv",
  "communicat",
  "propose",
  "analyz",
];

/** Deterministic fallback -- used when no scoring engine is configured/enabled,
 *  or the AI call fails. Never blocks a submission on an outage. */
function scoreTextHeuristic(text: string): ScoreResult {
  const clean = (text || "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lower = clean.toLowerCase();

  const outcomeHits = OUTCOME_SIGNALS.filter((s) => lower.includes(s)).length;
  const actionHits = ACTION_SIGNALS.filter((s) => lower.includes(s)).length;

  let score = 30;
  if (wordCount >= 25) score += 15;
  if (wordCount >= 60) score += 10;
  score += Math.min(outcomeHits, 3) * 10;
  score += Math.min(actionHits, 3) * 5;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const needsReview = score < 55 || wordCount < 15;

  let rationale = `Heuristic fallback scoring (no AI scoring engine configured/available): ${wordCount} words; ${actionHits} action-oriented and ${outcomeHits} outcome-oriented signal(s) detected. This is a word-count/keyword heuristic, not a model reading for substance -- directional only.`;
  if (needsReview) {
    rationale += " Flagged for human reviewer confirmation (human-in-the-loop requirement, Part 4).";
  }

  return { score, rationale, needsReview };
}

function scoringSystemPrompt(): string {
  return `You are an expert assessment-center evaluator, calibrated to the standards used at Korn Ferry, Mercer, WTW (Willis Towers Watson), and Thomas International. You grade one candidate's free-text answer to a single competency-based interview question.

Score strictly against the competency's own Basic/Skilled/Expert behavioural indicators provided to you -- not a generic rubric. A strong answer is grounded in a specific real (or clearly-reasoned hypothetical) situation, shows the candidate's own actions, and reflects genuine understanding of the competency at Skilled level or above. A weak answer is vague, generic, off-topic, or simply restates the question.

Score on a 0-100 scale, matching these bands:
- 85-100 (Exceeds): clearly demonstrates Expert-level indicators.
- 70-84 (Fully Meets): clearly demonstrates Skilled-level indicators.
- 50-69 (Partially Meets): shows some relevant behaviour but falls short of Skilled level, or is thin/generic.
- 0-49 (Does Not Meet): off-topic, contradicts the competency, or too short/vague to assess.

Set needsReview to true whenever the score is below 55, the answer is short or ambiguous, or you are otherwise not confident. A human reviewer always confirms the final score regardless (human-in-the-loop) -- this flag only tells them where to look first.

Write a rationale of 1-3 sentences, professional and factual, citing what the candidate actually said and which behavioural indicator it does or doesn't meet. Write it as a reviewer's note about the candidate, not addressed to them ("the candidate..." not "you...").

Return ONLY valid JSON matching this exact shape, with no markdown fences, no commentary, no leading or trailing text:
{"score": number, "rationale": string, "needsReview": boolean}`;
}

function buildScoringUserPrompt(questionPrompt: string, responseText: string, competency: CompetencyContext): string {
  const indicatorLines = competency.indicators.length
    ? competency.indicators.map((i) => `  - [${i.level}] ${i.indicator_text}`).join("\n")
    : "  (no behavioral indicators on file -- rely on the description only, do not invent indicators)";
  return `Competency: ${competency.name}\nDescription: ${competency.description || "(none provided)"}\nBehavioural indicators:\n${indicatorLines}\n\nQuestion asked:\n${questionPrompt}\n\nCandidate's answer:\n"""\n${responseText || "(no answer submitted)"}\n"""\n\nReturn the JSON now.`;
}

function validateScoreResult(data: unknown): ScoreResult {
  const d = (data || {}) as { score?: unknown; rationale?: unknown; needsReview?: unknown };
  const rawScore = Number(d.score);
  if (!Number.isFinite(rawScore)) throw new Error("Model returned a non-numeric score.");
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const rationale =
    typeof d.rationale === "string" && d.rationale.trim() ? d.rationale.trim() : "AI scoring engine returned no rationale.";
  const needsReview = !!d.needsReview || score < 55;
  return { score, rationale, needsReview };
}

async function callClaudeForScoring(
  apiKey: string,
  questionPrompt: string,
  responseText: string,
  competency: CompetencyContext
): Promise<ScoreResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: scoringSystemPrompt(),
      messages: [{ role: "user", content: buildScoringUserPrompt(questionPrompt, responseText, competency) }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Claude API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content || []).find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Claude returned no text content.");
  return validateScoreResult(extractJson(text));
}

async function callFuguForScoring(
  apiKey: string,
  questionPrompt: string,
  responseText: string,
  competency: CompetencyContext
): Promise<ScoreResult> {
  const res = await fetch("https://api.sakana.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "fugu",
      reasoning_effort: "medium",
      messages: [
        { role: "system", content: scoringSystemPrompt() },
        { role: "user", content: buildScoringUserPrompt(questionPrompt, responseText, competency) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Sakana Fugu API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Sakana Fugu returned no message content.");
  return validateScoreResult(extractJson(text));
}

async function callKimiForScoring(
  apiKey: string,
  questionPrompt: string,
  responseText: string,
  competency: CompetencyContext
): Promise<ScoreResult> {
  const res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "moonshot-v1-32k",
      temperature: 0.2,
      messages: [
        { role: "system", content: scoringSystemPrompt() },
        { role: "user", content: buildScoringUserPrompt(questionPrompt, responseText, competency) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Kimi API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Kimi returned no message content.");
  return validateScoreResult(extractJson(text));
}

/**
 * Scores one free-text answer. Uses the configured generation engine when
 * one is available (engine + apiKey both set); otherwise -- or if the AI
 * call throws for any reason -- falls back to the deterministic heuristic
 * so a candidate's submission is never blocked by an engine outage or
 * missing configuration.
 */
export async function scoreTextResponse(params: {
  questionPrompt: string;
  responseText: string;
  competency: CompetencyContext;
  engine: ScoringEngine | null;
  apiKey: string | null;
}): Promise<ScoreResult> {
  const { questionPrompt, responseText, competency, engine, apiKey } = params;

  if (!responseText || !responseText.trim()) {
    return { score: 0, rationale: "No response was submitted for this question.", needsReview: true };
  }

  if (engine && apiKey) {
    try {
      const call = engine === "claude" ? callClaudeForScoring : engine === "kimi" ? callKimiForScoring : callFuguForScoring;
      return await call(apiKey, questionPrompt, responseText, competency);
    } catch (err) {
      console.error(`AI scoring via ${engine} failed, falling back to the heuristic scorer:`, err);
    }
  }

  return scoreTextHeuristic(responseText);
}
