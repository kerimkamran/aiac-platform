// Spots free-text answers that are not real attempts: keyboard mashing,
// one word repeated, placeholder text, or symbols and digits only. Works the
// same for English, Azerbaijani and Russian (Latin and Cyrillic letters), and
// never judges how good an answer is -- only whether it is an answer at all.
// A false "nonsense" only ever asks a reviewer to look; it never hides text.

const VOWELS = /[aeiouyəıöüаеёиоуыэюяіє]/i;
const LETTER = /\p{L}/u;
const PLACEHOLDERS = new Set([
  "lorem", "ipsum", "asdf", "asd", "qwerty", "qwe", "zxc", "test", "testing", "xxx", "aaa", "blah", "bla", "abc",
  "фыва", "йцукен", "тест", "ааа", "ыыы",
]);

export type NonsenseCode = "symbols" | "repeated" | "single" | "random";
export type NonsenseCheck = { nonsense: boolean; reason: string | null; code?: NonsenseCode };

function isJunkToken(token: string): boolean {
  const t = token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (!t) return true;
  if (PLACEHOLDERS.has(t)) return true;
  if (!LETTER.test(t)) return true; // digits only
  if (/(.)\1{3,}/u.test(t)) return true; // "aaaa", "!!!!"
  if (t.length >= 4 && !VOWELS.test(t)) return true; // "sdfgh", "грр"
  if (/[^aeiouyəıöüаеёиоуыэюяіє\d]{6,}/iu.test(t)) return true; // long consonant run
  return false;
}

export function checkNonsense(text: string | null | undefined): NonsenseCheck {
  const clean = (text || "").trim();
  if (!clean) return { nonsense: false, reason: null }; // empty is handled as "no answer"

  const letters = (clean.match(/\p{L}/gu) || []).length;
  if (letters / clean.replace(/\s/g, "").length < 0.5) {
    return { nonsense: true, reason: "mostly symbols or numbers, not words", code: "symbols" };
  }

  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length >= 5) {
    const unique = new Set(tokens.map((t) => t.toLowerCase())).size;
    if (unique / tokens.length < 0.3) return { nonsense: true, reason: "the same few words repeated", code: "repeated" };
  }

  const junk = tokens.filter(isJunkToken).length;
  if (junk / tokens.length >= 0.5) {
    return tokens.length === 1
      ? { nonsense: true, reason: "a single random or placeholder word", code: "single" }
      : { nonsense: true, reason: "random keys or placeholder text", code: "random" };
  }

  return { nonsense: false, reason: null };
}
