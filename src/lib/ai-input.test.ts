import { describe, expect, it } from "vitest";
import { redactForAi } from "./ai-input";

describe("redactForAi", () => {
  it("removes Azerbaijani mobile numbers in common formats", () => {
    const r = redactForAi("Call +994 50 123 45 67 or 050-123-45-67 today.");
    expect(r.text).not.toMatch(/123/);
    expect(r.text).toContain("[PHONE REDACTED]");
    expect(r.report.phones).toBe(2);
  });

  it("removes e-mail addresses and counts them", () => {
    const r = redactForAi("Write to jane.doe@example.az for details.");
    expect(r.text).toBe("Write to [EMAIL REDACTED] for details.");
    expect(r.report).toEqual({ emails: 1, phones: 0 });
  });

  it("leaves years, scores, section numbers and date ranges alone", () => {
    const text = "Between 2019-2020 the team scored 85 of 100 in section 12, see 2021 2022.";
    const r = redactForAi(text);
    expect(r.text).toBe(text);
    expect(r.report.phones).toBe(0);
  });
});
