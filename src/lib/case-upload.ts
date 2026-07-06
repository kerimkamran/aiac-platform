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

const FIELD_KEYS = ["title", "competency", "difficulty", "methodology", "methodologynotes", "scenario", "question", "type", "options"];

function fieldKeyFor(line: string): { key: string; rest: string } | null {
  const m = line.match(/^#{0,3}\s*(Title|Competency|Difficulty|Methodology Notes|Methodology|Scenario|Question|Type|Options)\s*:\s*(.*)$/i);
  if (!m) return null;
  const key = m[1].toLowerCase().replace(/\s+/g, "");
  if (!FIELD_KEYS.includes(key)) return null;
  return { key, rest: m[2] };
}

export function parseStructuredText(text: string): ParseResult {
  const normalized = text.replace(/\r\n/g, "\n");
  const chunks = normalized
    .split(/\n\s*-{3,}\s*\n/)
    .flatMap((chunk) => {
      // Fallback split: if a chunk contains more than one "Title:" line, treat each as a separate case.
      const titleLineIdxs: number[] = [];
      const lines = chunk.split("\n");
      lines.forEach((l, i) => {
        if (/^#{0,3}\s*Title\s*:/i.test(l)) titleLineIdxs.push(i);
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

    for (const line of lines) {
      const match = fieldKeyFor(line);
      if (match) {
        currentKey = match.key;
        fields[currentKey] = fields[currentKey] || [];
        if (match.rest.trim()) fields[currentKey].push(match.rest.trim());
        continue;
      }
      if (/^[A-D][).]\s+/.test(line.trim())) {
        currentKey = "options";
        fields.options = fields.options || [];
        fields.options.push(line.trim());
        continue;
      }
      if (currentKey && line.trim()) {
        fields[currentKey] = fields[currentKey] || [];
        fields[currentKey].push(line.trim());
      }
    }

    const title = fields.title?.join(" ").trim();
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
      "No cases recognized. Use labeled fields (Title:, Competency:, Scenario:, Question:, Type:, Options:) separated by a line of ---."
    );
  }

  return { rows, errors };
}
