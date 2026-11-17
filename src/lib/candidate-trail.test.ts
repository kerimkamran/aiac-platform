import { describe, expect, it } from "vitest";
import { candidateTrail } from "./candidate-trail";

describe("candidateTrail", () => {
  it("says so when the invitation has not led to a sign-in", () => {
    const t = candidateTrail({ status: "invited", lastLoginAt: null });
    expect(t.neverSignedIn).toBe(true);
    expect(t.current).toBe("Invited, not signed in yet");
    expect(t.steps.map((s) => s.done)).toEqual([true, false, false, false, false]);
  });

  it("treats a sign-in as account ready", () => {
    const t = candidateTrail({ status: "invited", lastLoginAt: "2026-11-17T08:00:00Z" });
    expect(t.neverSignedIn).toBe(false);
    expect(t.current).toBe("Signed in, not started");
  });

  it("never shows a started candidate as not signed in", () => {
    const t = candidateTrail({ status: "in_progress", lastLoginAt: null });
    expect(t.neverSignedIn).toBe(false);
    expect(t.current).toBe("Started");
  });

  it("walks through to reviewed", () => {
    expect(candidateTrail({ status: "scored", lastLoginAt: "x" }).current).toBe("Submitted");
    const t = candidateTrail({ status: "reviewed", lastLoginAt: "x" });
    expect(t.current).toBe("Reviewed");
    expect(t.steps.every((s) => s.done)).toBe(true);
  });
});
