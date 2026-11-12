import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Clear Horizon plan, section 18: the design rules that are cheap to check by
// machine are checked here, so the old look cannot creep back in. A failure
// names the file, line and rule. (no-raw-colours.test.ts covers colours.)
const SRC = path.resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(e.name)) out.push(full);
  }
  return out;
}

const RULES: { name: string; re: RegExp; skip?: (file: string) => boolean }[] = [
  { name: "no uppercase labels (sentence case only)", re: /\buppercase\b/ },
  { name: "no wide letter-spacing", re: /\btracking-(?!tight\b|tighter\b)[\w[\].-]+/ },
  { name: "no text below 13px (text-2xs)", re: /\btext-2xs\b/ },
  { name: "no arbitrary pixel font sizes", re: /\btext-\[\d+px\]/ },
  { name: "no arbitrary radii", re: /\brounded-\[/ },
  { name: "no arbitrary shadows", re: /\bshadow-\[/ },
  { name: "no oversized radii (use rounded-card / rounded-dialog)", re: /\brounded-(2xl|3xl)\b/ },
  { name: "retired display font alias", re: /font-display/ },
  {
    name: "no hand-rolled primary button (use Button, ButtonLink or buttonClass)",
    re: /bg-brand text-on-primary[^"`]*hover:bg-brand-hover/,
    skip: (f) => f.includes(`${path.sep}components${path.sep}ui${path.sep}`),
  },
];

describe("design rules", () => {
  const files = walk(SRC);
  for (const rule of RULES) {
    it(rule.name, () => {
      const hits: string[] = [];
      for (const file of files) {
        if (rule.skip?.(file)) continue;
        const lines = fs.readFileSync(file, "utf8").split("\n");
        lines.forEach((line, i) => {
          // Comments may mention a banned class while explaining the ban.
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
          if (rule.re.test(line)) hits.push(`${path.relative(SRC, file)}:${i + 1}`);
        });
      }
      expect(hits, hits.join("\n")).toEqual([]);
    });
  }
});
