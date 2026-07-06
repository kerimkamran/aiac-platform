import { extractJson, type CompetencyForPrompt } from "@/lib/generation";

// Synthesized from a dedicated research pass (five parallel briefs, each citing
// only publicly published methodology — no proprietary test content) covering
// Hogan Assessments, Mercer | Mettl, WTW/Saville, Korn Ferry, and McLean &
// Company. This is the grounding playbook fed to the model when bulk-generating
// the case library; it never asks the model to reproduce anyone's actual items.
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

export type MethodologyTag =
  | "Hogan-style derailment"
  | "Mettl-style SJT"
  | "WTW/Saville-style situation"
  | "Korn Ferry-style exercise"
  | "McLean-style behavioral anchor"
  | "Blended";

export type CaseLibraryQuestionType = "mcq" | "text";

export type GeneratedCase = {
  title: string;
  scenarioText: string;
  questionStem: string;
  questionType: CaseLibraryQuestionType;
  options?: { text: string; correct?: boolean }[];
  difficulty: "mid" | "high";
  methodologyTag: MethodologyTag;
  methodologyNotes: string;
};

function systemInstructions(count: number): string {
  return `You are a senior assessment-center case designer building a large, reusable case library for a governed competency-based hiring platform, at the caliber of Hogan Assessments, Mercer|Mettl, WTW/Saville, and Korn Ferry.

Ground every case strictly in the competency name, description, and behavioral indicators provided to you. Do not invent facts, statistics, company names, or claims not implied by the provided competency material. Do not reproduce any real vendor's actual test content — everything you write must be original.

${CASE_DESIGN_PLAYBOOK}

Difficulty must be mid-to-high: genuine trade-offs, ambiguity, incomplete information, or competing stakeholder interests — not an obvious right-vs-wrong choice.

Return ONLY valid JSON, no markdown fences, no commentary:
{"cases": [{"title": string, "scenarioText": string, "questionStem": string, "questionType": "mcq" | "text", "options"?: [{"text": string, "correct"?: boolean}], "difficulty": "mid" | "high", "methodologyTag": "Hogan-style derailment" | "Mettl-style SJT" | "WTW/Saville-style situation" | "Korn Ferry-style exercise" | "McLean-style behavioral anchor" | "Blended", "methodologyNotes": string}]}

"methodologyNotes" should briefly explain (1 sentence) which design principle from the playbook shaped this specific case. Generate exactly ${count} distinct cases. Vary scenario premise, industry context, and question format (mix mcq and text) across the set — never repeat the same situation twice.`;
}

function buildUserPrompt(competency: CompetencyForPrompt): string {
  const indicatorLines = competency.indicators.length
    ? competency.indicators.map((i) => `  - [${i.level}] ${i.indicator_text}`).join("\n")
    : "  (no behavioral indicators on file — rely on the description only, do not invent indicators)";
  return `Competency code: ${competency.code}\nName: ${competency.name}\nCategory: ${competency.category}\nDescription: ${competency.description || "(none provided)"}\nBehavioral indicators:\n${indicatorLines}\n\nGenerate the case library entries now as JSON.`;
}

export function validateCases(data: unknown): GeneratedCase[] {
  if (!data || typeof data !== "object" || !Array.isArray((data as { cases?: unknown }).cases)) {
    throw new Error("Generated content did not match the expected shape (missing cases array).");
  }
  return (data as { cases: unknown[] }).cases.map((c) => {
    const cc = c as Partial<GeneratedCase> & Record<string, unknown>;
    if (typeof cc.title !== "string" || typeof cc.scenarioText !== "string" || typeof cc.questionStem !== "string") {
      throw new Error("A case was missing title, scenarioText, or questionStem.");
    }
    if (cc.questionType !== "mcq" && cc.questionType !== "text") {
      throw new Error("A case had an invalid questionType.");
    }
    const result: GeneratedCase = {
      title: cc.title.trim(),
      scenarioText: cc.scenarioText.trim(),
      questionStem: cc.questionStem.trim(),
      questionType: cc.questionType,
      difficulty: cc.difficulty === "high" ? "high" : "mid",
      methodologyTag: (typeof cc.methodologyTag === "string" ? cc.methodologyTag : "Blended") as MethodologyTag,
      methodologyNotes: typeof cc.methodologyNotes === "string" ? cc.methodologyNotes.trim() : "",
    };
    if (result.questionType === "mcq") {
      const opts = Array.isArray(cc.options) ? cc.options : [];
      result.options = opts
        .map((o) => {
          const oo = o as { text?: unknown; correct?: unknown };
          return { text: typeof oo.text === "string" ? oo.text.trim() : "", correct: !!oo.correct };
        })
        .filter((o) => o.text.length > 0);
      if (result.options.length < 2) throw new Error("An mcq case had fewer than 2 usable options.");
      if (!result.options.some((o) => o.correct)) result.options[0].correct = true;
    }
    return result;
  });
}

export async function callEngine(
  engine: "claude" | "fugu" | "kimi",
  apiKey: string,
  system: string,
  user: string
): Promise<string> {
  if (engine === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 8192, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`Claude API error (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`);
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content || []).find((c) => c.type === "text")?.text;
    if (!text) throw new Error("Claude returned no text content.");
    return text;
  }
  if (engine === "kimi") {
    const res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "moonshot-v1-32k",
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Kimi API error (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Kimi returned no message content.");
    return text;
  }
  const res = await fetch("https://api.sakana.ai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "fugu",
      reasoning_effort: "high",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Sakana Fugu API error (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Sakana Fugu returned no message content.");
  return text;
}

export async function generateCaseLibraryEntries(
  engine: "claude" | "fugu" | "kimi",
  apiKey: string,
  competency: CompetencyForPrompt,
  count: number
): Promise<GeneratedCase[]> {
  const raw = await callEngine(engine, apiKey, systemInstructions(count), buildUserPrompt(competency));
  return validateCases(extractJson(raw));
}
