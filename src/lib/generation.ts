import { CASE_DESIGN_PLAYBOOK, callEngine, extractJson, type EngineKey } from "@/lib/ai-engine";

export { extractJson };

export type CompetencyForPrompt = {
  code: string;
  name: string;
  category: string;
  description: string | null;
  indicators: { level: string; indicator_text: string }[];
};

export type GeneratedQuestion = {
  type: "mcq" | "text";
  prompt: string;
  options?: { text: string; correct?: boolean }[];
};

export type GeneratedSection = {
  competencyCode: string;
  questions: GeneratedQuestion[];
};

export type GeneratedAssessment = {
  sections: GeneratedSection[];
};

export type GenerationReport = {
  // Questions the model returned that were rejected (wrong option count, no
  // single correct answer, empty prompt). They are dropped, never repaired.
  droppedQuestions: number;
  droppedReasons: string[];
  // Which answer letter each kept MCQ's correct option ended up with after the
  // server-side shuffle, for the brief card and tests.
  correctLetters: Record<string, number>;
};

const MIN_TOTAL_QUESTIONS = 10;
const OPTIONS_PER_MCQ = 4;

// Follow-up ask: "make sure built assessments are intermediate to advance,
// challenge candidates." Anchoring generation only on Skilled/Expert indicators
// makes "intermediate to advanced" a structural property of the input, not just
// a prose instruction. Falls back to whatever indicators exist if a competency
// has only Basic ones on file, so a thinly-populated competency keeps its
// grounding material.
export function indicatorsForGeneration<T extends { level: string }>(indicators: T[]): T[] {
  const advanced = indicators.filter((i) => i.level !== "Basic");
  return advanced.length > 0 ? advanced : indicators;
}

export type GenerationLanguage = "en" | "az" | "ru";

const LANGUAGE_INSTRUCTION: Record<GenerationLanguage, string> = {
  en: "",
  az: "\n- Write ALL candidate-facing content (case narratives, questions, every answer option) in natural, professional Azerbaijani (Azərbaycan dili). Keep the JSON keys in English exactly as specified.",
  ru: "\n- Write ALL candidate-facing content (case narratives, questions, every answer option) in natural, professional Russian (русский язык). Keep the JSON keys in English exactly as specified.",
};

function systemInstructions(questionsPerCompetency: number, language: GenerationLanguage = "en"): string {
  return `You are a senior assessment-center designer with the caliber of practice used at Korn Ferry, Mercer, WTW (Willis Towers Watson), and Thomas International. You write situational judgment cases and competency-based interview-style questions for mid-to-senior management candidates in real organizations.

${CASE_DESIGN_PLAYBOOK}

Rules you must follow:
- Ground every case strictly in the competency name, description, and behavioral indicators provided to you. Do not invent facts, statistics, company names, or claims not implied by the provided competency material. The indicators you are given are deliberately limited to this platform's "Skilled" and "Expert" proficiency tiers (never "Basic"/entry-level) — write to that level.
- Difficulty must be intermediate-to-advanced, never basic or entry-level: cases should involve genuine trade-offs, ambiguity, incomplete information, competing stakeholder interests, or time/political pressure — the kind of scenario a mid-to-senior manager would find genuinely hard to reason through, not an obvious right-vs-wrong choice. The candidate should have to work for the right answer. Avoid simple, entry-level, or textbook-obvious scenarios, and avoid any question a manager with only basic/junior-level competence could answer correctly on instinct.
- Write realistic, workplace-grounded situational judgment cases (3-6 sentences of context, enough to establish real complexity) followed by a clear question, in the register and rigor of a professional assessment center — not generic trivia or textbook questions.
- For multiple-choice questions, write exactly 4 response options that represent genuinely plausible managerial responses of varying effectiveness (not one obviously-correct and three absurd distractors) — a strong candidate should have to think carefully to pick the best one. Mark exactly one as the most effective/correct response.
- For open-ended questions, ask the candidate to describe a specific past situation (behavioral/STAR-style) or how they would handle a hypothetical scenario, appropriate for evaluating the competency at a senior level.
- Vary question format across the set: prefer a mix of situational-judgment multiple-choice and open-ended behavioral questions.
- Do not repeat the same scenario premise (e.g. the same type of conflict, the same fictional department) across multiple questions — vary the industry context, stakeholders, and situation type across the set.
- Return ONLY valid JSON matching this exact TypeScript shape, with no markdown fences, no commentary, no leading or trailing text:

{"sections": [{"competencyCode": string, "questions": [{"type": "mcq" | "text", "prompt": string, "options"?: [{"text": string, "correct"?: boolean}]}]}]}

Generate exactly ${questionsPerCompetency} questions per competency provided. The assessment must contain at least ${MIN_TOTAL_QUESTIONS} questions in total across all competencies — this is a hard requirement.${LANGUAGE_INSTRUCTION[language]}`;
}

function buildUserPrompt(competencies: CompetencyForPrompt[]): string {
  const blocks = competencies
    .map((c) => {
      const indicators = indicatorsForGeneration(c.indicators);
      const indicatorLines = indicators.length
        ? indicators.map((i) => `  - [${i.level}] ${i.indicator_text}`).join("\n")
        : "  (no behavioral indicators on file — rely on the description only, do not invent indicators)";
      return `Competency code: ${c.code}\nName: ${c.name}\nCategory: ${c.category}\nDescription: ${c.description || "(none provided)"}\nBehavioral indicators (Skilled/Expert tier only):\n${indicatorLines}`;
    })
    .join("\n\n");

  return `Generate situational judgment cases and questions for the following governed competencies. Candidates are being assessed for mid-to-senior management roles.\n\n${blocks}\n\nReturn the JSON now.`;
}

// Fisher-Yates shuffle so the correct option is not always A. The correct
// flag travels with its option; only the display order changes.
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Validates the model's output. Invalid questions are dropped and counted, not
// repaired: an MCQ without exactly one correct answer used to get option A
// marked correct silently, which put wrong answers into published tests.
export function validateGenerated(data: unknown): { assessment: GeneratedAssessment; report: GenerationReport } {
  if (!data || typeof data !== "object" || !Array.isArray((data as { sections?: unknown }).sections)) {
    throw new Error("Generated content did not match the expected shape (missing sections array).");
  }

  const report: GenerationReport = { droppedQuestions: 0, droppedReasons: [], correctLetters: {} };
  const sections: GeneratedSection[] = [];

  for (const s of (data as { sections: unknown[] }).sections) {
    const sec = s as { competencyCode?: unknown; questions?: unknown };
    if (typeof sec.competencyCode !== "string" || !Array.isArray(sec.questions)) {
      throw new Error("A section was missing competencyCode or questions.");
    }
    const questions: GeneratedQuestion[] = [];

    for (const q of sec.questions) {
      const qq = q as { type?: unknown; prompt?: unknown; options?: unknown };
      const drop = (reason: string) => {
        report.droppedQuestions += 1;
        report.droppedReasons.push(reason);
      };

      if ((qq.type !== "mcq" && qq.type !== "text") || typeof qq.prompt !== "string" || !qq.prompt.trim()) {
        drop("question had no valid type or prompt");
        continue;
      }

      if (qq.type === "text") {
        questions.push({ type: "text", prompt: qq.prompt.trim() });
        continue;
      }

      const opts = (Array.isArray(qq.options) ? qq.options : [])
        .map((o) => {
          const oo = o as { text?: unknown; correct?: unknown };
          return { text: typeof oo.text === "string" ? oo.text.trim() : "", correct: oo.correct === true };
        })
        .filter((o) => o.text.length > 0);

      if (opts.length !== OPTIONS_PER_MCQ) {
        drop(`multiple-choice question had ${opts.length} options (need ${OPTIONS_PER_MCQ})`);
        continue;
      }
      if (opts.filter((o) => o.correct).length !== 1) {
        drop("multiple-choice question did not have exactly one correct answer");
        continue;
      }

      questions.push({ type: "mcq", prompt: qq.prompt.trim(), options: shuffle(opts) });
    }

    if (questions.length > 0) sections.push({ competencyCode: sec.competencyCode, questions });
  }

  const assessment = { sections };
  sections.forEach((sec) =>
    sec.questions.forEach((q, i) => {
      if (q.type === "mcq" && q.options) {
        const idx = q.options.findIndex((o) => o.correct);
        report.correctLetters[`${sec.competencyCode}#${i + 1}`] = idx;
      }
    })
  );
  return { assessment, report };
}

export type GenerationResult = { assessment: GeneratedAssessment; report: GenerationReport; usage: { model: string; inputTokens?: number; outputTokens?: number } };

export async function generateAssessmentContent(
  engine: EngineKey,
  apiKey: string,
  competencies: CompetencyForPrompt[],
  language: GenerationLanguage = "en"
): Promise<GenerationResult> {
  if (competencies.length === 0) throw new Error("No competencies were selected for generation.");

  // Ask for enough questions per competency to clear the 10-question floor,
  // even after some are dropped by validation (see the over-ask below).
  const questionsPerCompetency = Math.max(2, Math.ceil(MIN_TOTAL_QUESTIONS / competencies.length) + 1);

  const { text, usage } = await callEngine(
    engine,
    apiKey,
    systemInstructions(questionsPerCompetency, language),
    buildUserPrompt(competencies)
  );

  const { assessment, report } = validateGenerated(extractJson(text));

  const totalQuestions = assessment.sections.reduce((n, s) => n + s.questions.length, 0);
  if (totalQuestions < MIN_TOTAL_QUESTIONS) {
    throw new Error(
      `Only ${totalQuestions} usable questions came back (need at least ${MIN_TOTAL_QUESTIONS}; ${report.droppedQuestions} were rejected as invalid). Try again, or select more competencies.`
    );
  }

  return { assessment, report, usage };
}
