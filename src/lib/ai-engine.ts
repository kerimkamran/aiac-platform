// Shared engine layer for every AI call in the app: assessment generation,
// case-library generation, document extraction and (via extractJson) scoring.
//
// This file is a leaf: it imports nothing from the rest of src/lib, so the
// generation, case-library and case-upload modules can all depend on it
// without depending on each other (previously case-library imported from
// generation and case-upload reached back into both through dynamic imports).

export type EngineKey = "claude" | "fugu" | "kimi";

// Enough room for a full assessment (up to ~20 questions with four options
// each) without being cut off. The old limit of 4096 tokens silently truncated
// larger generations; cut-offs are now detected and reported instead.
export const CLAUDE_MAX_TOKENS = 16000;

export class AiOutputError extends Error {
  readonly code: "cut_off" | "no_content" | "bad_json";
  constructor(message: string, code: AiOutputError["code"]) {
    super(message);
    this.name = "AiOutputError";
    this.code = code;
  }
}

export type EngineUsage = { inputTokens?: number; outputTokens?: number; model: string };

export type EngineResult = { text: string; usage: EngineUsage };

// Staff-facing message. Never includes provider response bodies.
const CUT_OFF_MESSAGE =
  "The AI response was cut off before it finished, so nothing was saved. Try fewer competencies, or a shorter request, and generate again.";

export function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new AiOutputError("No JSON object found in the model's response.", "bad_json");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AiOutputError("The model's response was not valid JSON.", "bad_json");
  }
}

// Calls one engine with a system + user message and returns the raw text.
// Throws AiOutputError with code "cut_off" when the provider stopped because
// the output limit was reached, so callers can give a clear message instead of
// parsing half a document.
export async function callEngine(
  engine: EngineKey,
  apiKey: string,
  system: string,
  user: string,
  options: { maxTokens?: number } = {}
): Promise<EngineResult> {
  if (engine === "claude") {
    const model = "claude-sonnet-5";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? CLAUDE_MAX_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API error (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`);
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    if (data.stop_reason === "max_tokens") throw new AiOutputError(CUT_OFF_MESSAGE, "cut_off");
    const text = (data.content || []).find((c) => c.type === "text")?.text;
    if (!text) throw new AiOutputError("Claude returned no text content.", "no_content");
    return {
      text,
      usage: { model, inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
    };
  }

  const isKimi = engine === "kimi";
  const url = isKimi ? "https://api.moonshot.ai/v1/chat/completions" : "https://api.sakana.ai/v1/chat/completions";
  const model = isKimi ? "moonshot-v1-32k" : "fugu";
  const label = isKimi ? "Kimi" : "Sakana Fugu";
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (isKimi) body.temperature = 0.4;
  else body.reasoning_effort = "high";

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${label} API error (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") throw new AiOutputError(CUT_OFF_MESSAGE, "cut_off");
  const text = choice?.message?.content;
  if (!text) throw new AiOutputError(`${label} returned no message content.`, "no_content");
  return {
    text,
    usage: { model, inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens },
  };
}

// The grounding playbook fed to the model for both case-library generation and
// assessment generation. Synthesized from a research pass (Hogan, Mercer|Mettl,
// WTW/Saville, Korn Ferry, McLean & Company) covering only publicly published
// methodology; it never asks the model to reproduce anyone's actual items.
export const CASE_DESIGN_PLAYBOOK = `Ground every case in a stress, ambiguity, or change trigger rather than a routine day — derailment research Hogan Assessments popularized (tracing to Center for Creative Leadership studies) shows that judgment differences between strong and weak performers surface under pressure, fatigue, or transition, not under calm conditions. A good case should put a normally competent person under a believable strain.

Reuse the scenario archetypes that recur, independently, across Mercer|Mettl, WTW/Saville "Situations", and Korn Ferry's assessment-center exercise literature, because convergence across unrelated vendors is itself evidence these patterns are well-validated:
- an overloaded inbox / in-basket triage under time pressure with conflicting priorities
- a difficult conversation with an underperforming-but-tenured or previously strong team member
- a cross-functional or cross-team resource/priority conflict requiring negotiation
- a strategic decision that must be made on incomplete or ambiguous data
- an ethical or integrity gray area where a shortcut would relieve pressure
- a change-management rollout facing visible team resistance
- a cross-level communication challenge (translating a decision for both senior stakeholders and frontline staff at once)

For multiple-choice cases, write four response options that are all genuinely plausible actions a real manager might take, varying in effectiveness — never one obviously correct answer against three absurd distractors. Mercer|Mettl explicitly frames SJT items this way: "select or rank the best response from several plausible options."

Where relevant, separate what a person can competently DO from who they are UNDER STRESS — Korn Ferry's KF4D "whole-person" model and Hogan's bright-side/dark-side split both argue that competence alone is an incomplete predictor of how someone will actually perform in the moment described.

Every case must be traceable to a single named competency with a specific behavioral anchor, not a vague "shows good judgment" — McLean & Company's research treats leveled, behaviorally-anchored content as the non-negotiable mechanism that makes a competency actually assessable rather than just a label.

Vary the industry context, stakeholders, and specific situation across cases for the same competency — do not reuse the same premise twice.`;
