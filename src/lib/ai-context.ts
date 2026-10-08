// Admin-supplied role context (instructions, job description, notes and
// reference files) before it is shown to an AI engine.
//
// Rules applied here, in order:
//   1. Hidden content is removed: HTML comments and zero-width characters.
//      Our own prompt delimiters are removed so a file cannot close the block.
//   2. Personal data is redacted (e-mail addresses and phone numbers), and the
//      counts are kept so staff can see what was removed.
//   3. The total is held to a budget. Reference files are trimmed first, then
//      the job description. Instructions and notes are never trimmed silently:
//      the action rejects them when they are too long.
//
// The text returned here is "information about the role". The prompt builder
// in generation.ts wraps it in delimiters and tells the model it can never
// override the competency framework, answer format or fairness rules.

import { redactForAi, type RedactionReport } from "@/lib/ai-input";

export type ContextSource = "instructions" | "job_description" | "notes" | "reference_file";

export type ContextItem = { source: ContextSource; label: string; text: string };

export const CONTEXT_BUDGET_CHARS = 20000;
export const INSTRUCTIONS_MAX_CHARS = 4000;
export const NOTES_MAX_CHARS = 2000;
export const JD_MAX_CHARS = 30000;
export const REFERENCE_FILE_MAX_CHARS = 200 * 1024;
export const MAX_REFERENCE_FILES = 3;

export function sanitizeContextText(raw: string): string {
  return raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[​-‍⁠﻿]/g, "")
    .replace(/<<<|>>>/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

export type PreparedContext = {
  items: ContextItem[];
  // Labels of anything that was cut to fit the budget, for the brief card.
  trimmed: string[];
  redaction: RedactionReport;
  totalChars: number;
};

export function prepareContext(input: {
  instructions: string;
  jobDescription: string;
  notes: string;
  files: { name: string; text: string }[];
}): PreparedContext {
  const redaction: RedactionReport = { emails: 0, phones: 0 };
  const trimmed: string[] = [];

  const clean = (raw: string) => {
    const { text, report } = redactForAi(sanitizeContextText(raw));
    redaction.emails += report.emails;
    redaction.phones += report.phones;
    return text;
  };

  const instructions = clean(input.instructions);
  const notes = clean(input.notes);
  if (instructions.length > INSTRUCTIONS_MAX_CHARS) {
    throw new Error(`The shared instructions are too long (${instructions.length.toLocaleString()} characters; the limit is ${INSTRUCTIONS_MAX_CHARS.toLocaleString()}). Shorten them and try again.`);
  }
  if (notes.length > NOTES_MAX_CHARS) {
    throw new Error(`The notes for this position are too long (limit ${NOTES_MAX_CHARS.toLocaleString()} characters). Shorten them and try again.`);
  }

  let jd = clean(input.jobDescription).slice(0, JD_MAX_CHARS);
  const files = input.files.map((f) => ({ name: f.name.replace(/[<>\[\]]/g, "").slice(0, 80), text: clean(f.text).slice(0, REFERENCE_FILE_MAX_CHARS) }));

  const budget = CONTEXT_BUDGET_CHARS - instructions.length - notes.length;
  const items: ContextItem[] = [];
  if (instructions) items.push({ source: "instructions", label: "Shared instructions", text: instructions });
  if (notes) items.push({ source: "notes", label: "Notes for this position", text: notes });

  // Reference files are trimmed first (in order, the last one cut), then the
  // job description. Anything dropped is listed for the brief card.
  const fileTotal = files.reduce((n, f) => n + f.text.length, 0);
  if (jd.length + fileTotal > budget) {
    let left = Math.max(0, budget - jd.length);
    const kept: { name: string; text: string }[] = [];
    for (const f of files) {
      if (left <= 0) {
        trimmed.push(`reference file "${f.name}"`);
        continue;
      }
      if (f.text.length <= left) {
        kept.push(f);
        left -= f.text.length;
      } else {
        kept.push({ name: f.name, text: f.text.slice(0, left) });
        trimmed.push(`reference file "${f.name}"`);
        left = 0;
      }
    }
    files.splice(0, files.length, ...kept);

    const jdRoom = Math.max(0, budget - files.reduce((n, f) => n + f.text.length, 0));
    if (jd.length > jdRoom) {
      trimmed.push("job description");
      jd = jd.slice(0, jdRoom);
    }
  }

  if (jd) items.push({ source: "job_description", label: "Job description", text: jd });
  for (const f of files) {
    if (f.text) items.push({ source: "reference_file", label: `Reference file: ${f.name}`, text: f.text });
  }

  return {
    items,
    trimmed,
    redaction,
    totalChars: items.reduce((n, i) => n + i.text.length, 0),
  };
}
