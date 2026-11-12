import { describe, expect, it } from "vitest";
import { ALL_DICTS, LEGAL_TOKEN } from "./dictionaries";
import { en } from "./en";
import { langFromAcceptLanguage, resolveLang } from "./index";

// Every language has exactly the same shape as English, so a missing
// translation is a build failure rather than a blank on the page.
type Json = string | Json[] | { [k: string]: Json };

function shape(v: Json, path = ""): string[] {
  if (typeof v === "string") return [path];
  if (Array.isArray(v)) return [`${path}[${v.length}]`, ...v.flatMap((x, i) => shape(x, `${path}[${i}]`))];
  return Object.entries(v).flatMap(([k, x]) => shape(x, path ? `${path}.${k}` : k));
}

function strings(v: Json): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  return Object.values(v).flatMap(strings);
}

describe("dictionaries", () => {
  const base = shape(en as unknown as Json);
  for (const [lang, dict] of Object.entries(ALL_DICTS)) {
    it(`${lang} has the same keys and list lengths as English`, () => {
      expect(shape(dict as unknown as Json)).toEqual(base);
    });
    it(`${lang} has no empty strings`, () => {
      expect(strings(dict as unknown as Json).filter((s) => s.trim() === "")).toEqual([]);
    });
    it(`${lang} keeps the Legal tokens in the same places as English`, () => {
      const tokens = (d: unknown) => strings(d as Json).map((s) => [...s.matchAll(LEGAL_TOKEN)].map((m) => m[1]).join(","));
      expect(tokens(dict)).toEqual(tokens(en));
    });
    it(`${lang} never translates Vantage or Azerconnect`, () => {
      const d = dict as unknown as { common: { appName: string; company: string } };
      expect(d.common.appName).toBe("Vantage");
      expect(d.common.company).toBe("Azerconnect Group");
    });
  }

  it("uses sentence case for the English headlines (no all-caps labels)", () => {
    const shouting = strings(en as unknown as Json).filter((s) => s.length > 3 && s === s.toUpperCase() && /[A-Z]/.test(s) && !/\d/.test(s));
    expect(shouting).toEqual([]);
  });
});

describe("language choice", () => {
  it("uses the cookie first", () => {
    expect(resolveLang("az", "ru-RU,ru;q=0.9")).toBe("az");
  });
  it("then the browser language", () => {
    expect(resolveLang(undefined, "ru-RU,ru;q=0.9,en;q=0.5")).toBe("ru");
    expect(langFromAcceptLanguage("de-DE,az;q=0.8,en;q=0.5")).toBe("az");
  });
  it("then English", () => {
    expect(resolveLang(undefined, "de-DE")).toBe("en");
    expect(resolveLang("xx", null)).toBe("en");
  });
});
