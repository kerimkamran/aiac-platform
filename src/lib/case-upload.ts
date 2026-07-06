// Parsers for the Case Library's manual upload feature — lets a superadmin
// add cases from an existing Excel workbook, Word document, plain text file,
// or Markdown file instead of (or alongside) AI generation.
//
// Excel: one row per case, flexible header names (see COLUMN_ALIASES).
// Word/plain text/Markdown: labeled-field blocks separated by a line of
// three or more dashes ("---"), e.g.
//
//   Title: Handling a missed deadline
//   Competency: CF-F09
//   Difficulty: mid
//   Methodology: Mettl-style SJT
//   Scenario: <scenario text, can span multiple lines>
//   Question: <question stem>
//   Type: mcq
//   Options:
//   A) ...
//   B) ...
//   C) ...
//   D) ...
//   ---
//   Title: Next case...

import ExcelJS from "exceljs";
import type { CaseLibraryQuestionType, GeneratedCase, MethodologyTag } from "@/lib/case-library";

export const VALID_METHODOLOGY_TAGS: MethodologyTag[] = [
  "Hogan-style derailment",
  "Mettl-style SJT",
  "WTW/Saville-style situation",
  "Korn Ferry-style exercise",
  "McLean-style behavioral anchor",
  "Blended",
];

export type ParsedCaseRow = GeneratedCase & {
  ref: string; // row number or title, for error reporting
  competencyCode?: string;
  competencyName?: string;
};

export type ParseResult = { rows: ParsedCaseRow[]; errors: string[] };

function normalizeMethodologyTag(raw: string | undefined): MethodologyTag {
  if (!raw) return "Blended";
  const needle = raw.trim().toLowerCase();
  const match = VALID_METHODOLOGY_TAGS.find(
    (t) => t.toLowerCase() === needle || t.toLowerCase().includes(needle) || needle.includes(t.toLowerCase().split("-")[0])
  );
  return match || "Blended";
}

function normalizeDifficulty(raw: string | undefined): "mid" | "high" {
  return (raw || "").trim().toLowerCase().startsWith("h") ? "high" : "mid";
}

function normalizeQuestionType(raw: string | undefined, hasOptions: boolean): CaseLibraryQuestionType {
  const needle = (raw || "").trim().toLowerCase();
  if (needle.startsWith("text") || needle.startsWith("open")) return "text";
  if (needle.startsWith("mcq") || needle.startsWith("multi")) return "mcq";
  return hasOptions ? "mcq" : "text";
}

/* ---------------- Excel ---------------- */

const COLUMN_ALIASES: Record<string, string[]> = {
  competencyCode: ["competency code", "competency_code", "code"],
  competencyName: ["competency", "competency name", "competency_name"],
  title: ["title", "case title"],
  scenarioText: ["scenario", "scenario text", "scenario_text"],
  questionStem: ["question", "question stem", "question_stem", "prompt"],
  questionType: ["type", "question type", "question_type"],
  optionA: ["option a", "option_a", "a"],
  optionB: ["option b", "option_b", "b"],
  optionC: ["option c", "option_c", "c"],
  optionD: ["option d", "option_d", "d"],
  correctOption: ["correct option", "correct_option", "correct"],
  difficulty: ["difficulty"],
  methodologyTag: ["methodology", "methodology tag", "methodology_tag"],
  methodologyNotes: ["methodology notes", "methodology_notes", "notes"],
};

function matchColumn(header: string): string | null {
  const needle = header.trim().toLowerCase();
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(needle)) return field;
  }
  return null;
}

export async function parseExcelBuffer(buffer: ArrayBuffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: [], errors: ["The workbook has no sheets."] };

  const headerRow = sheet.getRow(1);
  const colByIndex: Record<number, string> = {};
  headerRow.eachCell((cell, colNumber) => {
    const field = matchColumn(String(cell.value ?? ""));
    if (field) colByIndex[colNumber] = field;
  });

  if (Object.values(colByIndex).filter((f) => f === "title" || f === "scenarioText" || f === "questionStem").length < 3) {
    return {
      rows: [],
      errors: [
        "Couldn't find Title, Scenario, and Question columns. Expected headers like: Competency, Title, Scenario, Question, Type, Option A-D, Difficulty, Methodology.",
      ],
    };
  }

  const rows: ParsedCaseRow[] = [];
  const errors: string[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (row.cellCount === 0 || row.values === undefined) continue;
    const values: Record<string, string> = {};
    row.eachCell((cell, colNumber) => {
      const field = colByIndex[colNumber];
      if (field) values[field] = String(cell.value ?? "").trim();
    });
    if (!values.title && !values.scenarioText && !values.questionStem) continue; // blank row

    const ref = `Row ${r}${values.title ? ` (${values.title})` : ""}`;
    if (!values.title || !values.scenarioText || !values.questionStem) {
      errors.push(`${ref}: missing title, scenario, or question — skipped.`);
      continue;
    }

    const options = [values.optionA, values.optionB, values.optionC, values.optionD]
      .filter((v) => v && v.trim().length > 0)
      .map((text, i) => ({ text: text.trim(), correct: values.correctOption?.trim().toUpperCase() === "ABCD"[i] }));

    const questionType = normalizeQuestionType(values.questionType, options.length > 0);
    if (questionType === "mcq" && options.length < 2) {
      errors.push(`${ref}: mcq type needs at least 2 options — skipped.`);
      continue;
    }
    if (questionType === "mcq" && !options.some((o) => o.correct)) options[0].correct = true;

    rows.push({
      ref,
      competencyCode: values.competencyCode || undefined,
      competencyName: values.competencyName || undefined,
      title: values.title,
      scenarioText: values.scenarioText,
      questionStem: values.questionStem,
      questionType,
      options: questionType === "mcq" ? options : undefined,
      difficulty: normalizeDifficulty(values.difficulty),
      methodologyTag: normalizeMethodologyTag(values.methodologyTag),
      methodologyNotes: values.methodologyNotes || "Imported from uploaded spreadsheet.",
    });
  }

  return { rows, errors };
}

/* ---------------- Word / plain text / Markdown ---------------- */
//
// Real-world markdown varies a lot more than a strict "Key: value" format —
// bold field labels (**Competency:** ...), a heading used as the case title
// instead of an explicit "Title:" line, list-style options (- A) ...), and
// alternate horizontal-rule styles (***, ___ as well as ---). The parser
// below normalizes all of these before falling back to reporting "no cases
// recognized".

const FIELD_KEYS = ["title", "competency", "difficulty", "methodologynotes", "methodology", "scenario", "question", "type", "options"];

// Strip markdown bold/strong markers (**text** / __text__) so "**Competency:**"
// and "Competency:" parse identically. Deliberately leaves single */_ (italics)
// alone since those appear inside ordinary prose far more often.
function stripBold(line: string): string {
  return line.replace(/\*\*(.*?)\*\*/g, "$1").replace(/__(.*?)__/g, "$1");
}

function fieldKeyFor(rawLine: string): { key: string; rest: string } | null {
  const line = stripBold(rawLine);
  const m = line.match(/^#{0,6}\s*(Title|Competency|Difficulty|Methodology Notes|Methodology|Scenario|Question|Type|Options)\s*:\s*(.*)$/i);
  if (!m) return null;
  const key = m[1].toLowerCase().replace(/\s+/g, "");
  if (!FIELD_KEYS.includes(key)) return null;
  return { key, rest: m[2] };
}

function headingTextFor(rawLine: string): string | null {
  const m = stripBold(rawLine).match(/^#{1,6}\s+(.*\S)\s*$/);
  return m ? m[1] : null;
}

// Matches "A) text", "A. text", optionally preceded by a markdown list bullet
// ("- A) text", "* A) text", "1. A) text") or wrapped in bold.
function optionLineFor(rawLine: string): { letter: string; text: string } | null {
  const line = stripBold(rawLine).trim().replace(/^(?:[-*+]\s+|\d+[.)]\s+)/, "");
  const m = line.match(/^([A-D])[).]\s+(.*)$/);
  return m ? { letter: m[1], text: m[2] } : null;
}

export function parseStructuredText(text: string): ParseResult {
  const normalized = text.replace(/\r\n/g, "\n");
  const chunks = normalized
    .split(/\n\s*(?:-{3,}|\*{3,}|_{3,})\s*\n/)
    .flatMap((chunk) => {
      // Fallback split: if a chunk contains more than one "Title:" line (bold or
      // plain), treat each as a separate case even without an explicit ---.
      const lines = chunk.split("\n");
      const titleLineIdxs: number[] = [];
      lines.forEach((l, i) => {
        const f = fieldKeyFor(l);
        if (f && f.key === "title") titleLineIdxs.push(i);
      });
      if (titleLineIdxs.length <= 1) return [chunk];
      return titleLineIdxs.map((start, i) => lines.slice(start, titleLineIdxs[i + 1] ?? lines.length).join("\n"));
    })
    .map((c) => c.trim())
    .filter(Boolean);

  const rows: ParsedCaseRow[] = [];
  const errors: string[] = [];

  chunks.forEach((chunk, idx) => {
    const lines = chunk.split("\n");
    const fields: Record<string, string[]> = {};
    let currentKey: string | null = null;
    let firstHeading: string | null = null;

    for (const line of lines) {
      const match = fieldKeyFor(line);
      if (match) {
        currentKey = match.key;
        fields[currentKey] = fields[currentKey] || [];
        if (match.rest.trim()) fields[currentKey].push(match.rest.trim());
        continue;
      }
      const opt = optionLineFor(line);
      if (opt) {
        currentKey = "options";
        fields.options = fields.options || [];
        fields.options.push(`${opt.letter}) ${opt.text}`);
        continue;
      }
      const heading = headingTextFor(line);
      if (heading !== null) {
        if (firstHeading === null) firstHeading = heading;
        currentKey = null; // a heading always ends whatever field was accumulating
        continue;
      }
      if (currentKey && line.trim()) {
        fields[currentKey] = fields[currentKey] || [];
        fields[currentKey].push(line.trim());
      }
    }

    const title = (fields.title?.join(" ").trim()) || firstHeading || undefined;
    const scenarioText = fields.scenario?.join(" ").trim();
    const questionStem = fields.question?.join(" ").trim();
    const ref = `Block ${idx + 1}${title ? ` (${title})` : ""}`;

    if (!title || !scenarioText || !questionStem) {
      if (title || scenarioText || questionStem) {
        errors.push(`${ref}: missing title, scenario, or question — skipped.`);
      }
      return;
    }

    const optionLines = fields.options || [];
    const options = optionLines.map((l) => {
      const m = l.match(/^([A-D])[).]\s+(.*)$/);
      return { text: (m ? m[2] : l).trim(), key: m ? m[1] : "" };
    });
    const correctKey = fields.correct?.join("").trim().toUpperCase();
    const questionType = normalizeQuestionType(fields.type?.join(" "), options.length > 0);

    if (questionType === "mcq" && options.length < 2) {
      errors.push(`${ref}: mcq type needs at least 2 options — skipped.`);
      return;
    }

    const mappedOptions = options.map((o) => ({ text: o.text, correct: correctKey ? o.key === correctKey : false }));
    if (questionType === "mcq" && !mappedOptions.some((o) => o.correct) && mappedOptions.length > 0) {
      mappedOptions[0].correct = true;
    }

    rows.push({
      ref,
      competencyCode: fields.competency?.join(" ").trim() || undefined,
      competencyName: undefined,
      title,
      scenarioText,
      questionStem,
      questionType,
      options: questionType === "mcq" ? mappedOptions : undefined,
      difficulty: normalizeDifficulty(fields.difficulty?.join(" ")),
      methodologyTag: normalizeMethodologyTag(fields.methodology?.join(" ")),
      methodologyNotes: fields.methodologynotes?.join(" ").trim() || "Imported from uploaded document.",
    });
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push(
      "No cases recognized in the structured-field format. Use labeled fields (Title:, Competency:, Scenario:, Question:, Type:, Options:), plain or **bold**, separated by a line of ---. If your document is freeform (research notes, prose, an existing case bank in a different layout), turn on \"Also try AI-assisted extraction\" below."
    );
  }

  return { rows, errors };
}

/* ---------------- AI-assisted extraction (freeform documents) ---------------- */
//
// Fallback for documents that don't follow the structured field format at all —
// e.g. a pasted research note, an existing case bank with its own layout, or
// prose. Reuses the same generation engines already configured for the Case
// Library (Claude / Sakana Fugu / Kimi) rather than inventing a new provider.

export type AiExtractedRow = ParsedCaseRow & { competencyGuess?: string };

function aiExtractionSystemPrompt(competencyList: string): string {
  return `You are helping populate an assessment-center case library from an arbitrary uploaded document. The document may already contain well-formed situational judgment cases in some layout, research notes describing scenarios, or a mix. Extract every distinct, usable assessment case you can find.

For each case, also guess which ONE competency from this list it best fits (by code), or null if none fit well:
${competencyList}

Do not invent cases that aren't actually supported by the document content. Do not reproduce any copyrighted vendor test content verbatim — paraphrase into original wording grounded in what the document describes.

Return ONLY valid JSON, no markdown fences, no commentary:
{"cases": [{"title": string, "scenarioText": string, "questionStem": string, "questionType": "mcq" | "text", "options"?: [{"text": string, "correct"?: boolean}], "difficulty": "mid" | "high", "methodologyTag": "Hogan-style derailment" | "Mettl-style SJT" | "WTW/Saville-style situation" | "Korn Ferry-style exercise" | "McLean-style behavioral anchor" | "Blended", "methodologyNotes": string, "competencyCode": string | null}]}`;
}

export async function extractCasesWithAI(
  engine: "claude" | "fugu" | "kimi",
  apiKey: string,
  text: string,
  competencies: { code: string; name: string }[]
): Promise<{ rows: AiExtractedRow[]; truncated: boolean }> {
  const { callEngine, validateCases } = await import("@/lib/case-library");
  const { extractJson } = await import("@/lib/generation");

  const MAX_CHARS = 14000;
  const truncated = text.length > MAX_CHARS;
  const clipped = truncated ? text.slice(0, MAX_CHARS) : text;

  const competencyList = competencies.map((c) => `${c.code} — ${c.name}`).join("\n");
  const system = aiExtractionSystemPrompt(competencyList);
  const raw = await callEngine(engine, apiKey, system, `Document contents:\n\n${clipped}`);
  const data = extractJson(raw) as { cases?: (Record<string, unknown> & { competencyCode?: unknown })[] };
  const competencyCodes = (data.cases || []).map((c) => (typeof c.competencyCode === "string" ? c.competencyCode : undefined));
  const validated = validateCases(data);

  const rows: AiExtractedRow[] = validated.map((c, i) => ({
    ...c,
    ref: `AI-extracted case ${i + 1} (${c.title})`,
    competencyCode: competencyCodes[i] || undefined,
  }));

  return { rows, truncated };
}
