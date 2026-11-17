import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Next.js refuses a "use server" file that exports anything but async
// functions (types are fine). It only shows up in the production build, so
// this test catches it before a deploy does.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

describe("server action files", () => {
  it("export only async functions and types", () => {
    const offenders: string[] = [];
    for (const file of walk("src")) {
      const text = readFileSync(file, "utf8");
      if (!/^\s*["']use server["']/.test(text)) continue;
      for (const line of text.split("\n")) {
        if (/^export\s+(const|let|var|class|enum|default)\b/.test(line)) offenders.push(`${file}: ${line.trim()}`);
        if (/^export\s+function\b/.test(line)) offenders.push(`${file}: ${line.trim()} (must be async)`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
