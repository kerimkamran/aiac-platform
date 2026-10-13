import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { AA_LARGE_TEXT, AA_NORMAL_TEXT, contrastRatio, extractHexTokens, extractThemeBlocks } from "./contrast";

// Plan v2, Phase 2 (Appendix A): extends the contrast checks to the Node Grid
// pairs the redesign relies on, in both themes and on every canvas. Text pairs
// must reach 4.5:1; control borders and focus rings must reach 3:1 against the
// surface they sit on (WCAG 1.4.11).

const cssText = fs.readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
const { light, dark } = extractThemeBlocks(cssText);

const canvasBlocks = Array.from(
  cssText.matchAll(/:root:not\(\.dark\)\[data-canvas="(\w+)"\]\s*\{([^}]*)\}/g)
).map((m) => ({ name: m[1], tokens: extractHexTokens(m[2]) }));

const TEXT_PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["muted", "background"],
  ["muted", "surface"],
  ["muted", "surface-sunken"],
  ["on-primary", "brand-deep"],
  ["on-primary-container", "primary-container"],
  ["on-secondary-container", "secondary-container"],
  ["accent", "background"],
  ["accent", "surface"],
  ["accent-dark", "accent-soft"],
  ["good", "surface"],
  ["warning", "surface"],
  ["critical", "surface"],
  ["good", "good-soft"],
  ["warning", "warning-soft"],
  ["critical", "critical-soft"],
];

const CONTROL_PAIRS: [string, string][] = [
  ["line-control", "surface"],
  ["line-control", "background"],
  ["focus", "background"],
  ["focus", "surface"],
];

const THEMES: [string, string][] = [
  ["light", light],
  ["dark", dark],
];

describe.each(THEMES)("Node Grid %s theme", (_name, block) => {
  const tokens = extractHexTokens(block);

  it("defines every token the pairs need", () => {
    const needed = new Set([...TEXT_PAIRS.flat(), ...CONTROL_PAIRS.flat()]);
    for (const t of needed) expect(tokens[t], `--${t} is missing`).toBeDefined();
  });

  for (const [text, bg] of TEXT_PAIRS) {
    it(`--${text} on --${bg} reaches AA text contrast`, () => {
      expect(contrastRatio(tokens[text], tokens[bg])).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  }

  for (const [part, bg] of CONTROL_PAIRS) {
    it(`--${part} on --${bg} reaches the 3:1 non-text contrast`, () => {
      expect(contrastRatio(tokens[part], tokens[bg])).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
    });
  }
});

describe.each(canvasBlocks.map((c) => [c.name, c.tokens] as const))("light canvas %s", (_name, overrides) => {
  const base = extractHexTokens(light);
  const tokens = { ...base, ...overrides };

  for (const [text, bg] of TEXT_PAIRS.filter(([, b]) => b === "background" || b === "surface-sunken")) {
    it(`--${text} on --${bg} reaches AA text contrast`, () => {
      expect(contrastRatio(tokens[text], tokens[bg])).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  }
});

it("has the cream and grey canvases defined", () => {
  expect(canvasBlocks.map((c) => c.name).sort()).toEqual(["cream", "grey"]);
});
