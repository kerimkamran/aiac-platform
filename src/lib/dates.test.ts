import { describe, expect, it } from "vitest";
import { ageLabel, daysSince, dueLabel, greeting } from "./dates";

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
