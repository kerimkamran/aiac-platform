import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { AA_NORMAL_TEXT, contrastRatio, extractHexTokens, extractThemeBlocks } from "./contrast";

// Design-execution-plan Phase 1 / T1.6 -- guards the T1.1 fix (three greys
// of body text collapsing to two, because the lightest one -- `--faint` --
// never cleared WCAG AA as text color) so the scale can't silently regress
// back to a too-light grey later. Reads the live globals.css rather than a
// copy of the token values, so it fails the moment the source of truth
// drifts from what it asserts.
//
// Scope: the neutral body-text hierarchy only (`--foreground`, `--muted`)
// against every surface background text is actually painted on in this
// app. Semantic status colors (good/warning/critical) are checked against
// their own dedicated tinted backgrounds, not the general surface set --
// they're always paired with a matching soft background by the component
// that uses them, never dropped onto a plain page background.

const cssPath = path.resolve(__dirname, "../app/globals.css");
const cssText = fs.readFileSync(cssPath, "utf8");
const { light, dark } = extractThemeBlocks(cssText);

const TEXT_TOKENS = ["foreground", "muted"] as const;
const BACKGROUND_TOKENS = ["background", "surface", "surface-sunken"] as const;

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("%s theme body text contrast (WCAG AA, >= 4.5:1)", (_themeName, block) => {
  const tokens = extractHexTokens(block);

  it("defines every token this test needs to check", () => {
    for (const t of [...TEXT_TOKENS, ...BACKGROUND_TOKENS]) {
      expect(tokens[t], `--${t} is missing from this theme's block`).toBeDefined();
    }
  });

  for (const textToken of TEXT_TOKENS) {
    for (const bgToken of BACKGROUND_TOKENS) {
      it(`--${textToken} on --${bgToken}`, () => {
        const ratio = contrastRatio(tokens[textToken], tokens[bgToken]);
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      });
    }
  }
});
