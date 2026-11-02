import { en, type Dict } from "./en";
import { az } from "./az";
import { ru } from "./ru";
import type { Lang } from "./index";

export type { Dict };

const DICTS: Record<Lang, Dict> = { en, az, ru };

export function getDict(lang: Lang): Dict {
  return DICTS[lang] ?? en;
}

export const ALL_DICTS = DICTS;

// Facts Azerconnect Legal must supply appear in the dictionaries as tokens
// written as a LEGAL marker in double angle brackets. Split a string into plain text and tokens so the
// page can render each token as a visible "to be confirmed" marker.
export const LEGAL_TOKEN = /⟦LEGAL:([a-z-]+)⟧/g;

export type LegalPart = { type: "text"; value: string } | { type: "legal"; key: string };

export function splitLegal(text: string): LegalPart[] {
  const parts: LegalPart[] = [];
  let last = 0;
  for (const m of text.matchAll(LEGAL_TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ type: "text", value: text.slice(last, at) });
    parts.push({ type: "legal", key: m[1] });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}
