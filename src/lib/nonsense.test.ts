import { describe, expect, it } from "vitest";
import { checkNonsense } from "./nonsense";

describe("checkNonsense", () => {
  it.each([
    "asdf asdf asdf",
    "sdfghjkl",
    "qwerty",
    "lorem ipsum dolor",
    "aaaaaaa",
    "123 456 7890",
    "!!! ??? ...",
    "ok ok ok ok ok ok ok ok",
    "фыва йцукен",
    "jjjj kkkk llll",
    "xcvbnm sdfgh qwrtp",
  ])("flags %j", (text) => {
    expect(checkNonsense(text).nonsense).toBe(true);
  });

  it.each([
    "I would call the client first, agree a fix with the network team and promise a follow-up within the hour.",
    "Müştəriyə əvvəlcə zəng edərdim, şəbəkə komandası ilə həll yolunu razılaşdırardım.",
    "Сначала я бы позвонил клиенту и согласовал решение с командой сети.",
    "Track KPIs in the CRM and review SLA breaches weekly with HR and SMTP logs.",
    "Yes.",
    "Strengths: rhythm, structure.",
  ])("does not flag a real answer: %j", (text) => {
    expect(checkNonsense(text).nonsense).toBe(false);
  });

  it("leaves empty answers to the 'no response' path", () => {
    expect(checkNonsense("   ").nonsense).toBe(false);
    expect(checkNonsense(null).nonsense).toBe(false);
  });
});
