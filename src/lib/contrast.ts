// WCAG 2.1 contrast-ratio math, plus a tiny reader for this app's own
// design-token source of truth (src/app/globals.css) -- so the contrast
// unit test (Design-execution-plan Phase 1 / T1.6) asserts against the
// real, current token values rather than a hand-copied snapshot that can
// drift out of sync with the CSS.

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  const clean = hex.trim().replace(/^#/, "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex color: "${hex}"`);
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG contrast ratio between two colors, from 1 (identical) to 21 (black/white). */
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA thresholds. Normal text needs 4.5:1; large text (>=18pt, or
 *  >=14pt bold) and non-text UI components need 3:1. */
export const AA_NORMAL_TEXT = 4.5;
export const AA_LARGE_TEXT = 3;

/**
 * Extracts `--token: #hexvalue;` declarations from a block of CSS text
 * (e.g. the body of a `:root { ... }` or `.dark { ... }` rule). Only
 * matches hex colors -- this app's token values are all plain hex, never
 * rgb()/hsl()/color-mix() at the definition site, and a test asserting
 * against something that isn't a literal color is a test asserting
 * against nothing.
 */
export function extractHexTokens(cssBlock: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const re = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssBlock))) {
    tokens[m[1]] = m[2];
  }
  return tokens;
}

/**
 * Splits globals.css into its `:root` (light theme) and `.dark` (dark
 * theme) token blocks. Both are simple, non-nested `{ ... }` rules in this
 * file, so a non-greedy brace match is sufficient -- no CSS parser needed.
 */
export function extractThemeBlocks(cssText: string): { light: string; dark: string } {
  const rootMatch = cssText.match(/:root\s*\{([^}]*)\}/);
  const darkMatch = cssText.match(/\.dark\s*\{([^}]*)\}/);
  if (!rootMatch) throw new Error("globals.css: could not find a :root { ... } block.");
  if (!darkMatch) throw new Error("globals.css: could not find a .dark { ... } block.");
  return { light: rootMatch[1], dark: darkMatch[1] };
}
