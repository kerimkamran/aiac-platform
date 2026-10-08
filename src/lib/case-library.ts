import { CASE_DESIGN_PLAYBOOK, callEngine, extractJson, type EngineKey } from "@/lib/ai-engine";
import { indicatorsForGeneration, type CompetencyForPrompt } from "@/lib/generation";


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

Ground every case strictly in the competency name, description, and behavioral indicators provided to you. Do not invent facts, statistics, company names, or claims not implied by the provided competency material. Do not reproduce any real vendor's actual test content — everything you write must be original. The indicators you are given are deliberately limited to this platform's "Skilled" and "Expert" proficiency tiers (never "Basic"/entry-level) — write to that level.

${CASE_DESIGN_PLAYBOOK}

Difficulty must be intermediate-to-advanced, never basic or entry-level: genuine trade-offs, ambiguity, incomplete information, or competing stakeholder interests — not an obvious right-vs-wrong choice. The candidate should have to work for the right answer; avoid any question a manager with only basic/junior-level competence could answer correctly on instinct.

Return ONLY valid JSON, no markdown fences, no commentary:
{"cases": [{"title": string, "scenarioText": string, "questionStem": string, "questionType": "mcq" | "text", "options"?: [{"text": string, "correct"?: boolean}], "difficulty": "mid" | "high", "methodologyTag": "Hogan-style derailment" | "Mettl-style SJT" | "WTW/Saville-style situation" | "Korn Ferry-style exercise" | "McLean-style behavioral anchor" | "Blended", "methodologyNotes": string}]}

"methodologyNotes" should briefly explain (1 sentence) which design principle from the playbook shaped this specific case. Generate exactly ${count} distinct cases. Vary scenario premise, industry context, and question format (mix mcq and text) across the set — never repeat the same situation twice.`;
}

function buildUserPrompt(competency: CompetencyForPrompt): string {
    const indicators = indicatorsForGeneration(competency.indicators);
  const indicatorLines = indicators.length
    ? indicators.map((i) => `  - [${i.level}] ${i.indicator_text}`).join("\n")
    : "  (no behavioral indicators on file — rely on the description only, do not invent indicators)";
  return `Competency code: ${competency.code}\nName: ${competency.name}\nCategory: ${competency.category}\nDescription: ${competency.description || "(none provided)"}\nBehavioral indicators (Skilled/Expert tier only):\n${indicatorLines}\n\nGenerate the case library entries now as JSON.`;
}

// Keeps only usable cases. An mcq case needs 2-4 options with exactly one
// correct answer; anything else is dropped and reported, never repaired by
// silently marking option A correct.
export function validateCases(data: unknown): { cases: GeneratedCase[]; dropped: string[] } {
  if (!data || typeof data !== "object" || !Array.isArray((data as { cases?: unknown }).cases)) {
    throw new Error("Generated content did not match the expected shape (missing cases array).");
  }
  const cases: GeneratedCase[] = [];
  const dropped: string[] = [];

  for (const c of (data as { cases: unknown[] }).cases) {
    const cc = c as Partial<GeneratedCase> & Record<string, unknown>;
    const label = typeof cc.title === "string" && cc.title.trim() ? cc.title.trim() : "untitled case";
    if (typeof cc.title !== "string" || typeof cc.scenarioText !== "string" || typeof cc.questionStem !== "string") {
      dropped.push(`${label}: missing title, scenario, or question`);
      continue;
    }
    if (cc.questionType !== "mcq" && cc.questionType !== "text") {
      dropped.push(`${label}: invalid question type`);
      continue;
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
      const usable = opts
        .map((o) => {
          const oo = o as { text?: unknown; correct?: unknown };
          return { text: typeof oo.text === "string" ? oo.text.trim() : "", correct: oo.correct === true };
        })
        .filter((o) => o.text.length > 0);
      if (usable.length < 2 || usable.length > 4) {
        dropped.push(`${label}: mcq needs 2-4 options`);
        continue;
      }
      if (usable.filter((o) => o.correct).length !== 1) {
        dropped.push(`${label}: mcq needs exactly one correct option`);
        continue;
      }
      result.options = usable;
    }
    cases.push(result);
  }
  return { cases, dropped };
}

export async function generateCaseLibraryEntries(
  engine: EngineKey,
  apiKey: string,
  competency: CompetencyForPrompt,
  count: number
): Promise<GeneratedCase[]> {
  const { text } = await callEngine(engine, apiKey, systemInstructions(count), buildUserPrompt(competency));
  const { cases, dropped } = validateCases(extractJson(text));
  if (cases.length === 0) {
    throw new Error(`No usable cases came back (${dropped.length} rejected: ${dropped.slice(0, 3).join("; ")}).`);
  }
  return cases;
}
