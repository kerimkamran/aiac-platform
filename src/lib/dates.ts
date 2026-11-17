// Small date helpers for the homes. Pure, so they are easy to test.
const DAY = 86_400_000;

// "today", "1 day", "5 days" since a moment. Never negative.
export function ageLabel(from: string | Date | null | undefined, now: Date = new Date()): string {
  if (!from) return "";
  const days = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / DAY));
  if (days === 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}

export function daysSince(from: string | Date | null | undefined, now: Date = new Date()): number {
  if (!from) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / DAY));
}

// "due today", "due in 3 days", "2 days overdue".
export function dueLabel(due: string | Date | null | undefined, now: Date = new Date()): string {
  if (!due) return "";
  const days = Math.ceil((new Date(due).getTime() - now.getTime()) / DAY);
  if (days < 0) return days === -1 ? "1 day overdue" : `${-days} days overdue`;
  if (days === 0) return "due today";
  return days === 1 ? "due tomorrow" : `due in ${days} days`;
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// How long a scored candidate may wait for a person before the staff home flags
// it. Default agreed in the design plan (owner item: confirm with HR).
export const REVIEW_TARGET_DAYS = 3;

/* ---- Translated versions (English, Azerbaijani, Russian) ---- */

// The dictionary part these helpers need. Strings carry {n} for the number.
export type DateWords = {
  dueToday: string;
  dueTomorrow: string;
  dueInOne: string;
  dueInFew: string;
  dueInMany: string;
  overdueOne: string;
  overdueFew: string;
  overdueMany: string;
  morning: string;
  afternoon: string;
  evening: string;
};

type PluralLang = "en" | "az" | "ru";

// Which word form a number takes. English and Azerbaijani only separate one
// from the rest; Russian has one (1, 21), few (2-4, 22-24) and many.
export function pluralForm(lang: PluralLang, n: number): "one" | "few" | "many" {
  if (lang !== "ru") return n === 1 ? "one" : "many";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "one";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
  return "many";
}

const fill = (text: string, n: number) => text.replace("{n}", String(n));

// Same rules as dueLabel, in the person's language.
export function dueLabelIn(
  lang: PluralLang,
  words: DateWords,
  due: string | Date | null | undefined,
  now: Date = new Date()
): string {
  if (!due) return "";
  const days = Math.ceil((new Date(due).getTime() - now.getTime()) / DAY);
  if (days < 0) {
    const n = -days;
    const form = pluralForm(lang, n);
    return fill(form === "one" ? words.overdueOne : form === "few" ? words.overdueFew : words.overdueMany, n);
  }
  if (days === 0) return words.dueToday;
  if (days === 1) return words.dueTomorrow;
  const form = pluralForm(lang, days);
  return fill(form === "one" ? words.dueInOne : form === "few" ? words.dueInFew : words.dueInMany, days);
}

export function greetingIn(words: DateWords, now: Date = new Date()): string {
  const h = now.getHours();
  return h < 5 ? words.evening : h < 12 ? words.morning : h < 18 ? words.afternoon : words.evening;
}

// The locale to format dates with. English keeps the server's default, as
// before; Azerbaijani and Russian use day.month.year.
export function localeFor(lang: PluralLang): string | undefined {
  return lang === "az" ? "az-AZ" : lang === "ru" ? "ru-RU" : undefined;
}

// A short date in the person's language.
export function formatDateIn(lang: PluralLang, d: string | Date): string {
  return new Date(d).toLocaleDateString(localeFor(lang));
}

// A date with the time, for notifications.
export function formatDateTimeIn(lang: PluralLang, d: string | Date): string {
  return new Date(d).toLocaleString(localeFor(lang));
}

// Fills {name} markers in a dictionary string.
export function fillText(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}
