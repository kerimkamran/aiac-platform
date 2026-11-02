import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Clear Horizon plan, sections 9 and 19: the trust section carries facts only
// Azerconnect Legal can supply (retention period, legal basis, privacy contact,
// confirmation that a person checks every score). Until Legal fills them in
// they are placeholders: ⟦LEGAL:key⟧ tokens in the dictionaries, or the marker
// text on the privacy page.
//
// Two checks:
//  1. Always: every placeholder is one of the registered keys, so none sneaks
//     in unnoticed, and the privacy page is covered too.
//  2. Release gate: with RELEASE_BUILD=1 (npm run release-check) the test
//     FAILS while any placeholder remains. Run it before removing the noindex
//     setting and announcing the page.

export const REGISTERED = ["person-check", "retention", "rights", "contact", "controller", "basis"] as const;

const SRC = path.resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

const found: { file: string; key: string }[] = [];
for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(/⟦LEGAL:([a-z-]+)⟧/g)) found.push({ file: path.relative(SRC, file), key: m[1] });
  for (const m of text.matchAll(/LEGAL_PLACEHOLDER\(([a-z-]+)\)/g)) found.push({ file: path.relative(SRC, file), key: m[1] });
}

describe("Legal placeholders", () => {
  it("only uses registered keys", () => {
    const unknown = found.filter((f) => !(REGISTERED as readonly string[]).includes(f.key));
    expect(unknown, unknown.map((u) => `${u.file}: ${u.key}`).join("\n")).toEqual([]);
  });

  it.runIf(process.env.RELEASE_BUILD === "1")("none remain (release gate)", () => {
    expect(found, `Azerconnect Legal still has to supply:\n${found.map((f) => `  ${f.key}  (${f.file})`).join("\n")}`).toEqual([]);
  });
});
