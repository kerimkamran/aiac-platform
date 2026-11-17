import { describe, expect, it } from "vitest";
import { deadlineFromDate, orgToday } from "./deadline";

describe("deadlines", () => {
  const now = new Date("2026-11-17T21:30:00Z"); // already 01:30 on the 18th in Baku

  it("uses the organisation's calendar day", () => {
    expect(orgToday(now)).toBe("2026-11-18");
  });

  it("stores the end of the picked day in Baku time", () => {
    const r = deadlineFromDate("2026-11-20", now);
    expect(r).toEqual({ ok: true, iso: "2026-11-20T19:59:59.000Z" });
  });

  it("accepts today and rejects a past date", () => {
    expect(deadlineFromDate("2026-11-18", now).ok).toBe(true);
    expect(deadlineFromDate("2026-11-17", now).ok).toBe(false);
  });

  it("treats an empty value as no deadline and rejects nonsense", () => {
    expect(deadlineFromDate("", now)).toEqual({ ok: true, iso: null });
    expect(deadlineFromDate("20/11/2026", now).ok).toBe(false);
    expect(deadlineFromDate("2026-13-45", now).ok).toBe(false);
  });
});
