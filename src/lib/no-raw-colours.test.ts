import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Plan v2, section 4: every colour in the app comes from a Node Grid token
// (src/app/globals.css) or from src/lib/brand.ts for the places that cannot
// read CSS variables (PDF, Excel, email). This test fails when a hard-coded
// Tailwind palette class or a hex value turns up anywhere else, so the
// redesign cannot quietly drift back to the old colours.

const SRC = path.resolve(__dirname, "..");
const ALLOWED = new Set([path.join(SRC, "lib", "brand.ts")]);

const PALETTE =
  /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|from|via|to|fill|stroke|divide|outline|shadow|placeholder|accent|decoration|caret)-(?:red|rose|pink|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|slate|gray|zinc|neutral|stone)-\d{2,3}\b/;
const BRACKET_COLOUR = /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-\[#/;
const HEX = /#[0-9a-fA-F]{3,6}(?![\w-])/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Comment-only lines describe colours; they are not styles, so they are skipped.
function isComment(line: string) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

describe("no hard-coded colours outside the design tokens", () => {
  const offenders: string[] = [];
  for (const file of walk(SRC)) {
    if (ALLOWED.has(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (isComment(line)) return;
      if (PALETTE.test(line) || BRACKET_COLOUR.test(line) || HEX.test(line)) {
        offenders.push(`${path.relative(SRC, file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
  }

  it("uses tokens instead of palette classes or hex values", () => {
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
