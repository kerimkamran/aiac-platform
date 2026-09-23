import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Design-execution-plan Phase 1 / T1.7 -- a lint guard, paired with the
// contrast unit test (T1.6), so the type/color scale that T1.1-T1.5
// establish can't quietly erode class-name by class-name afterward.
// Two patterns, banned wherever they can appear in a className -- a plain
// string literal or a template literal chunk:
//   1. Raw bracket font sizes (text-[13px], text-[10.5px], ...) -- the
//      scale in globals.css (--text-2xs..--text-2xl) exists specifically
//      so nobody has to invent a one-off size again, and so nothing below
//      the 12px AA-legibility floor can sneak back in.
//   2. `text-faint` -- the retired third grey. It failed WCAG AA as body
//      text (~3.45:1 in light mode, see T1.1); its non-text uses survive
//      renamed to `line-strong`, which this rule does not touch.
const RESTRICTED_CLASSNAME_PATTERNS = [
  {
    regex: "text-\\[[0-9.]+(px|rem)\\]",
    message:
      "Raw bracket font size (e.g. text-[13px]) is banned -- use the type scale instead (text-2xs/xs/sm/base/lg/xl/2xl, defined in globals.css). Design-execution-plan T1.2/T1.7.",
  },
  {
    regex: "\\btext-faint\\b",
    message:
      "`text-faint` was retired -- it failed WCAG AA contrast as body text (T1.1). Use `text-muted` instead. (`border-faint`/`bg-faint` are unaffected -- renamed to `line-strong` for their non-text uses.)",
  },
];

const restrictedClassnameRules = RESTRICTED_CLASSNAME_PATTERNS.flatMap(({ regex, message }) => [
  { selector: `Literal[value=/${regex}/]`, message },
  { selector: `TemplateElement[value.raw=/${regex}/]`, message },
]);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...restrictedClassnameRules],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
