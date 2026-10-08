import { describe, expect, it } from "vitest";
import {
  CONTEXT_BUDGET_CHARS,
  INSTRUCTIONS_MAX_CHARS,
  JD_MAX_CHARS,
  NOTES_MAX_CHARS,
  prepareContext,
  sanitizeContextText,
} from "./ai-context";

const base = { instructions: "", jobDescription: "", notes: "", files: [] as { name: string; text: string }[] };

describe("sanitizeContextText", () => {
  it("removes hidden HTML comments, zero-width characters and our own delimiters", () => {
    const out = sanitizeContextText("Visible <!-- hidden instruction -->text​ <<<END>>> more");
    expect(out).not.toContain("hidden");
    expect(out).not.toContain("​");
    expect(out).not.toContain("<<<");
    expect(out).not.toContain(">>>");
    expect(out).toContain("Visible");
  });
});

describe("prepareContext", () => {
  it("redacts e-mail addresses and phone numbers and counts them", () => {
    const prepared = prepareContext({ ...base, jobDescription: "Contact jane.doe@example.com or +994 50 123 45 67 for details." });
    const jd = prepared.items.find((i) => i.source === "job_description");
    expect(jd?.text).not.toContain("jane.doe@example.com");
    expect(prepared.redaction.emails).toBe(1);
    expect(prepared.redaction.phones).toBeGreaterThanOrEqual(1);
  });

  it("rejects instructions and notes that are too long instead of cutting them silently", () => {
    expect(() => prepareContext({ ...base, instructions: "a".repeat(INSTRUCTIONS_MAX_CHARS + 1) })).toThrow(/too long/);
    expect(() => prepareContext({ ...base, notes: "a".repeat(NOTES_MAX_CHARS + 1) })).toThrow(/too long/);
  });

  it("trims reference files before the job description and reports what was cut", () => {
    const bigJd = "j".repeat(JD_MAX_CHARS);
    const files = [
      { name: "one.md", text: "1".repeat(9000) },
      { name: "two.md", text: "2".repeat(9000) },
      { name: "three.md", text: "3".repeat(9000) },
    ];
    const prepared = prepareContext({ ...base, jobDescription: bigJd, files });
    expect(prepared.totalChars).toBeLessThanOrEqual(CONTEXT_BUDGET_CHARS);
    expect(prepared.trimmed.some((t) => t.includes("reference file"))).toBe(true);
    const jd = prepared.items.find((i) => i.source === "job_description");
    expect(jd).toBeDefined();
  });

  it("keeps everything when it fits the budget", () => {
    const prepared = prepareContext({
      instructions: "Focus on telecoms.",
      jobDescription: "Account manager for enterprise clients.",
      notes: "Top ten accounts.",
      files: [{ name: "policy.md", text: "Escalation policy." }],
    });
    expect(prepared.trimmed).toEqual([]);
    expect(prepared.items.map((i) => i.source)).toEqual(["instructions", "notes", "job_description", "reference_file"]);
  });
});
