import { describe, expect, it } from "vitest";
import { clampExtra, examDeadlineMs, formatClock, MAX_EXTRA_MINUTES } from "./exam-time";

describe("exam time", () => {
  const start = "2026-11-10T09:00:00Z";
  it("adds the limit", () => {
    expect(examDeadlineMs(start, 30)).toBe(new Date("2026-11-10T09:30:00Z").getTime());
  });
  it("adds extra minutes", () => {
    expect(examDeadlineMs(start, 30, 15)).toBe(new Date("2026-11-10T09:45:00Z").getTime());
  });
  it("defaults to 60 minutes when the limit is missing", () => {
    expect(examDeadlineMs(start, null)).toBe(new Date("2026-11-10T10:00:00Z").getTime());
  });
  it("clamps extra time", () => {
    expect(clampExtra(-5)).toBe(0);
    expect(clampExtra(9999)).toBe(MAX_EXTRA_MINUTES);
    expect(clampExtra("abc")).toBe(0);
    expect(clampExtra(12.4)).toBe(12);
  });
  it("formats the clock", () => {
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(-3)).toBe("0:00");
  });
});
