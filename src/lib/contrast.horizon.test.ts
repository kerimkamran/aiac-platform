import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { AA_LARGE_TEXT, AA_NORMAL_TEXT, contrastRatio, extractHexTokens, extractThemeBlocks } from "./contrast";

// Clear Horizon design plan, section 5 and the acceptance checklist: every
// colour pair listed there meets WCAG AA in light, dark and on all three light
// canvases, and the increased-contrast overrides darken text and borders. The
// test reads the live globals.css, so it fails the moment a token drifts.

const cssText = fs.readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
const { light, dark } = extractThemeBlocks(cssText);
const L = extractHexTokens(light);
// The dark block overrides the light one; tokens it does not redefine (the
// mark, whose tile is always night navy) fall through.
const D = { ...L, ...extractHexTokens(dark) };

function canvas(name: string) {
  const m = cssText.match(new RegExp(`:root:not\\(\\.dark\\)\\[data-canvas="${name}"\\]\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`canvas ${name} missing`);
  return { ...L, ...extractHexTokens(m[1]) };
}

function ratio(t: Record<string, string>, a: string, b: string) {
  expect(t[a], `--${a} missing`).toBeDefined();
  expect(t[b], `--${b} missing`).toBeDefined();
  return contrastRatio(t[a], t[b]);
}

const TEXT_PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["foreground", "surface-sunken"],
  ["muted", "background"],
  ["muted", "surface"],
  ["muted", "surface-sunken"],
  ["on-primary", "brand"],
  ["on-primary", "brand-hover"],
  ["on-primary", "brand-pressed"],
  ["on-primary-container", "primary-container"],
  ["accent", "background"],
  ["accent", "surface"],
  ["accent", "surface-sunken"],
  ["accent-dark", "accent-soft"],
  ["good", "surface"],
  ["warning", "surface"],
  ["critical", "surface"],
  ["good", "good-soft"],
  ["warning", "warning-soft"],
  ["critical", "critical-soft"],
  ["on-good", "good"],
  ["on-warning", "warning"],
  ["on-critical", "critical"],
  ["on-panel", "panel"],
  ["on-panel-muted", "panel"],
  ["on-panel-green", "panel"],
];

const GRAPHIC_PAIRS: [string, string][] = [
  ["line-control", "surface"],
  ["line-control", "background"],
  ["line-control", "surface-sunken"],
  ["focus", "surface"],
  ["focus", "background"],
  ["panel-line", "panel"],
  ["mark-from", "mark-tile"],
  ["mark-to", "mark-tile"],
  ["mark-node", "mark-tile"],
  ["horizon-from", "background"],
  ["horizon-to", "background"],
  ["chart-1", "surface"],
  ["chart-2", "surface"],
  ["chart-3", "surface"],
  ["chart-4", "surface"],
];

describe.each([
  ["light (white)", L],
  ["light (cream)", canvas("cream")],
  ["light (grey)", canvas("grey")],
  ["dark", D],
] as const)("Clear Horizon %s", (_name, tokens) => {
  for (const [a, b] of TEXT_PAIRS) {
    it(`--${a} on --${b} reaches AA text contrast`, () => {
      expect(ratio(tokens, a, b)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  }
  for (const [a, b] of GRAPHIC_PAIRS) {
    it(`--${a} on --${b} reaches the 3:1 graphics contrast`, () => {
      expect(ratio(tokens, a, b)).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
    });
  }
});

describe("Clear Horizon dark raised surface", () => {
  it("--muted and --foreground read on --raised", () => {
    expect(ratio(D, "muted", "raised")).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(ratio(D, "foreground", "raised")).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(ratio(D, "line-control", "raised")).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
  });
});

describe("Clear Horizon plan values", () => {
  it("keeps the colours the plan names", () => {
    expect(L.brand.toLowerCase()).toBe("#133e72");
    expect(L.secondary.toLowerCase()).toBe("#356d1b");
    expect(L.panel.toLowerCase()).toBe("#0c2a4f");
    expect(L.accent.toLowerCase()).toBe("#1d5aa6");
    expect(D.brand.toLowerCase()).toBe("#9cc0f0");
    expect(D["on-primary"].toLowerCase()).toBe("#08182e");
  });
});

describe("increased contrast", () => {
  const media = cssText.match(/@media \(prefers-contrast: more\)\s*\{([\s\S]*?)\n\}/);
  it("is defined", () => {
    expect(media).not.toBeNull();
  });
  const lightMore = media ? extractHexTokens(media[1].match(/:root:not\(\.dark\)\s*\{([^}]*)\}/)?.[1] ?? "") : {};
  const darkMore = media ? extractHexTokens(media[1].match(/\.dark\s*\{([^}]*)\}/)?.[1] ?? "") : {};

  it("darkens muted text and control borders in light mode", () => {
    expect(lightMore.muted).toBeDefined();
    expect(lightMore["line-control"]).toBeDefined();
    const sunken = canvas("cream")["surface-sunken"];
    expect(contrastRatio(lightMore.muted, sunken)).toBeGreaterThan(contrastRatio(L.muted, sunken));
    expect(contrastRatio(lightMore["line-control"], L.surface)).toBeGreaterThan(contrastRatio(L["line-control"], L.surface));
    expect(contrastRatio(lightMore.muted, sunken)).toBeGreaterThanOrEqual(7);
  });
  it("lightens muted text and control borders in dark mode", () => {
    expect(darkMore.muted).toBeDefined();
    expect(contrastRatio(darkMore.muted, D.raised)).toBeGreaterThan(contrastRatio(D.muted, D.raised));
    expect(contrastRatio(darkMore["line-control"], D.raised)).toBeGreaterThan(contrastRatio(D["line-control"], D.raised));
  });
});
