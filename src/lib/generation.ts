
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

const SYSTEM_INSTRUCTIONS = `You are a senior assessment-center designer with the caliber of practice used at Korn Ferry, Mercer, WTW (Willis Towers Watson), and Thomas International. You write situational judgment cases and competency-based interview-style questions for mid-to-senior management candidates in real organizations.

Rules you must follow:
- Ground every case strictly in the competency name, description, and behavioral indicators provided to you. Do not invent facts, statistics, company names, or claims not implied by the provided competency material.
- Write realistic, workplace-grounded situational judgment cases (2-5 sentences of context) followed by a clear question, in the register and rigor of a professional assessment center — not generic trivia or textbook questions.
- For multiple-choice questions, write exactly 4 response options that represent genuinely plausible managerial responses of varying effectiveness (not one obviously-correct and three absurd distractors). Mark exactly one as the most effective/correct response.
- For open-ended questions, ask the candidate to describe a specific past situation (behavioral/STAR-style) or how they would handle a hypothetical scenario, appropriate for evaluating the competency.
- Vary question format across the set: prefer a mix of situational-judgment multiple-choice and open-ended behavioral questions.
- Return ONLY valid JSON matching this exact TypeScript shape, with no markdown fences, no commentary, no leading or trailing text:

{"sections": [{"competencyCode": string, "questions": [{"type": "mcq" | "text", "prompt": string, "options"?: [{"text": string, "correct"?: boolean}]}]}]}

Generate exactly 2 questions per competency provided.`;

function buildUserPrompt(competencies: CompetencyForPrompt[]): string {
  const blocks = competencies
    .map((c) => {
      const indicatorLines = c.indicators.length
        ? c.indicators.map((i) => `  - [${i.level}] ${i.indicator_text}`).join("\n")
        : "  (no behavioral indicators on file — rely on the description only, do not invent indicators)";
      return `Competency code: ${c.code}\nName: ${c.name}\nCategory: ${c.category}\nDescription: ${c.description || "(none provided)"}\nBehavioral indicators:\n${indicatorLines}`;
    })
    .join("\n\n");

  return `Generate situational judgment cases and questions for the following governed competencies. Candidates are being assessed for mid-to-senior management roles.\n\n${blocks}\n\nReturn the JSON now.`;
}

function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in the model's response.");
  return JSON.parse(text.slice(start, end + 1));
}

function validateGenerated(data: unknown): GeneratedAssessment {
  if (!data || typeof data !== "object" || !Array.isArray((data as { sections?: unknown }).sections)) {
    throw new Error("Generated content did not match the expected shape (missing sections array).");
  }
  const sections = (data as { sections: unknown[] }).sections.map((s) => {
    const sec = s as { competencyCode?: unknown; questions?: unknown };
    if (typeof sec.competencyCode !== "string" || !Array.isArray(sec.questions)) {
      throw new Error("A section was missing competencyCode or questions.");
    }
    const questions = sec.questions.map((q) => {
      const qq = q as { type?: unknown; prompt?: unknown; options?: unknown };
      if ((qq.type !== "mcq" && qq.type !== "text") || typeof qq.prompt !== "string" || !qq.prompt.trim()) {
        throw new Error("A question was missing a valid type or prompt.");
      }
      const question: GeneratedQuestion = { type: qq.type, prompt: qq.prompt.trim() };
      if (qq.type === "mcq") {
        const opts = Array.isArray(qq.options) ? qq.options : [];
        question.options = opts
          .map((o) => {
            const oo = o as { text?: unknown; correct?: unknown };
            return { text: typeof oo.text === "string" ? oo.text.trim() : "", correct: !!oo.correct };
          })
          .filter((o) => o.text.length > 0);
        if (question.options.length < 2) throw new Error("An MCQ question had fewer than 2 usable options.");
        if (!question.options.some((o) => o.correct)) question.options[0].correct = true;
      }
      return question;
    });
    return { competencyCode: sec.competencyCode, questions };
  });
  return { sections };
}

async function callClaude(apiKey: string, competencies: CompetencyForPrompt[]): Promise<GeneratedAssessment> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system: SYSTEM_INSTRUCTIONS,
      messages: [{ role: "user", content: buildUserPrompt(competencies) }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Claude API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content || []).find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Claude returned no text content.");
  return validateGenerated(extractJson(text));
}

async function callPerplexity(apiKey: string, competencies: CompetencyForPrompt[]): Promise<GeneratedAssessment> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTIONS },
        { role: "user", content: buildUserPrompt(competencies) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Perplexity API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Perplexity returned no message content.");
  return validateGenerated(extractJson(text));
}

async function callKimi(apiKey: string, competencies: CompetencyForPrompt[]): Promise<GeneratedAssessment> {
  const res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "moonshot-v1-32k",
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTIONS },
        { role: "user", content: buildUserPrompt(competencies) },
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
  return validateGenerated(extractJson(text));
}

export type GenerationEngine = "claude" | "perplexity" | "kimi";

export async function generateAssessmentContent(
  engine: GenerationEngine,
  apiKey: string,
  competencies: CompetencyForPrompt[]
): Promise<GeneratedAssessment> {
  if (competencies.length === 0) throw new Error("No competencies were selected for generation.");
  if (engine === "claude") return callClaude(apiKey, competencies);
  if (engine === "kimi") return callKimi(apiKey, competencies);
  return callPerplexity(apiKey, competencies);
}
