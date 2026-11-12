// Languages (design plan, section 17): a small typed dictionary per language,
// no library. The language comes from a cookie, then the browser's language,
// then English. This file is safe to import from client components; the
// server-only lookup lives in ./server.ts.
export const LANGS = ["en", "az", "ru"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "vantage-lang";

export const LANG_LABEL: Record<Lang, string> = { en: "EN", az: "AZ", ru: "RU" };
export const LANG_NAME: Record<Lang, string> = { en: "English", az: "Azərbaycan dili", ru: "Русский" };

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "az" || v === "ru";
}

// Picks the first supported language in an Accept-Language header.
export function langFromAcceptLanguage(header: string | null | undefined): Lang | null {
  if (!header) return null;
  const parts = header
    .split(",")
    .map((p) => {
      const [tag, ...params] = p.trim().split(";");
      const q = params.map((x) => x.trim()).find((x) => x.startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((p) => p.tag && Number.isFinite(p.q))
    .sort((a, b) => b.q - a.q);
  for (const { tag } of parts) {
    const base = tag.split("-")[0];
    if (isLang(base)) return base;
  }
  return null;
}

export function resolveLang(cookieValue: string | null | undefined, acceptLanguage: string | null | undefined): Lang {
  if (isLang(cookieValue)) return cookieValue;
  return langFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LANG;
}
