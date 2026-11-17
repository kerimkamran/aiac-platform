import { describe, expect, it } from "vitest";
import { ageLabel, daysSince, dueLabel, dueLabelIn, fillText, formatDateIn, greeting, greetingIn, pluralForm } from "./dates";
import { az } from "@/i18n/az";
import { en } from "@/i18n/en";
import { ru } from "@/i18n/ru";

const now = new Date("2026-11-10T12:00:00Z");
describe("time helpers", () => {
  it("ages", () => {
    expect(ageLabel("2026-11-10T01:00:00Z", now)).toBe("today");
    expect(ageLabel("2026-11-09T01:00:00Z", now)).toBe("1 day");
    expect(ageLabel("2026-11-05T12:00:00Z", now)).toBe("5 days");
    expect(ageLabel(null, now)).toBe("");
    expect(daysSince("2027-01-01T00:00:00Z", now)).toBe(0);
  });
  it("due labels", () => {
    expect(dueLabel("2026-11-13T12:00:00Z", now)).toBe("due in 3 days");
    expect(dueLabel("2026-11-10T20:00:00Z", now)).toBe("due tomorrow");
    expect(dueLabel("2026-11-08T12:00:00Z", now)).toBe("2 days overdue");
    expect(dueLabel(undefined, now)).toBe("");
  });
  it("greets", () => {
    expect(greeting(new Date(2026, 10, 10, 9))).toBe("Good morning");
    expect(greeting(new Date(2026, 10, 10, 14))).toBe("Good afternoon");
  });
});

describe("translated time helpers", () => {
  it("picks Russian plural forms", () => {
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map((n) => pluralForm("ru", n))).toEqual([
      "one", "few", "few", "many", "many", "many", "many", "one", "few", "many", "one", "many",
    ]);
    expect([1, 2, 21].map((n) => pluralForm("en", n))).toEqual(["one", "many", "many"]);
  });
  it("matches the English helper in English", () => {
    for (const iso of ["2026-11-13T12:00:00Z", "2026-11-10T20:00:00Z", "2026-11-08T12:00:00Z", "2026-11-09T12:00:00Z", "2026-11-10T12:00:00Z"]) {
      expect(dueLabelIn("en", en.dates, iso, now)).toBe(dueLabel(iso, now));
    }
  });
  it("words due dates in Russian and Azerbaijani", () => {
    expect(dueLabelIn("ru", ru.dates, "2026-11-13T12:00:00Z", now)).toBe("срок через 3 дня");
    expect(dueLabelIn("ru", ru.dates, "2026-11-15T12:00:00Z", now)).toBe("срок через 5 дней");
    expect(dueLabelIn("ru", ru.dates, "2026-11-08T12:00:00Z", now)).toBe("просрочено на 2 дня");
    expect(dueLabelIn("ru", ru.dates, "2026-11-09T12:00:00Z", now)).toBe("просрочено на 1 день");
    expect(dueLabelIn("az", az.dates, "2026-11-13T12:00:00Z", now)).toBe("son tarixə 3 gün qalıb");
    expect(dueLabelIn("az", az.dates, "2026-11-08T12:00:00Z", now)).toBe("2 gün gecikib");
    expect(dueLabelIn("ru", ru.dates, null, now)).toBe("");
  });
  it("greets in each language", () => {
    expect(greetingIn(az.dates, new Date(2026, 10, 10, 9))).toBe("Sabahınız xeyir");
    expect(greetingIn(ru.dates, new Date(2026, 10, 10, 20))).toBe("Добрый вечер");
  });
  it("formats dates and fills markers", () => {
    expect(formatDateIn("ru", "2026-11-17T12:00:00Z")).toBe("17.11.2026");
    expect(formatDateIn("az", "2026-11-17T12:00:00Z")).toBe("17.11.2026");
    expect(fillText("{n} min · {date}", { n: 5, date: "x" })).toBe("5 min · x");
    expect(fillText("keeps {other}", { n: 1 })).toBe("keeps {other}");
  });
});

describe("counted phrases", () => {
  it("uses the right form in each language", async () => {
    const { pluralText } = await import("./dates");
    expect(pluralText("ru", 1, ru.candidate.exam.words)).toBe("1 слово.");
    expect(pluralText("ru", 3, ru.candidate.exam.words)).toBe("3 слова.");
    expect(pluralText("ru", 11, ru.candidate.exam.unanswered).startsWith("Без ответа остались 11 вопросов")).toBe(true);
    expect(pluralText("en", 1, en.candidate.exam.words)).toBe("1 word.");
    expect(pluralText("en", 0, en.candidate.exam.words)).toBe("0 words.");
    expect(pluralText("az", 5, az.candidate.exam.minutesLeft)).toBe("5 dəqiqə qalıb.");
  });
});
