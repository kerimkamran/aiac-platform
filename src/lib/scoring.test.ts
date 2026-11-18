import { describe, expect, it } from "vitest";

import { isUnreadByAi, readableRationale } from "./scoring";

describe("old-engine rationale", () => {
  const legacy =
    "Phase-1 rule-based scoring: 5 words; 0 action-oriented and 0 outcome-oriented signal(s) detected against the competency's Skilled-level behavioural anchors. This is a simulated engine (SRS Part 4 specifies the production LLM-based engine as Product Vision) — directional only. Flagged for human reviewer confirmation (human-in-the-loop requirement, Part 4).";
  it("is reworded for reviewers and counted as unread by the AI", () => {
    expect(isUnreadByAi(legacy)).toBe(true);
    const text = readableRationale(legacy);
    expect(text).toContain("Not read by the AI scorer");
    expect(text).toContain("5 words");
    expect(text).not.toMatch(/SRS|Phase-1|simulated/);
  });
  it("leaves other rationales alone", () => {
    expect(readableRationale("Clear, specific example.")).toBe("Clear, specific example.");
    expect(isUnreadByAi("Clear, specific example.")).toBe(false);
  });
});

describe("fallback scorer and nonsense answers", () => {
  it("scores random keys 0, flags them and says why", async () => {
    const { scoreTextResponse, isUnreadByAi } = await import("./scoring");
    const r = await scoreTextResponse({
      questionPrompt: "What do you do first?",
      responseText: "asdf qwerty sdfgh",
      competency: { name: "Customer focus", description: null, indicators: [] },
      engine: null,
      apiKey: null,
    });
    expect(r.score).toBe(0);
    expect(r.needsReview).toBe(true);
    expect(r.rationale).toMatch(/does not look like a real answer/);
    expect(isUnreadByAi(r.rationale)).toBe(true);
  });

  it("still scores a real answer by length and structure", async () => {
    const { scoreTextResponse } = await import("./scoring");
    const r = await scoreTextResponse({
      questionPrompt: "What do you do first?",
      responseText: "I call the client first. Then I agree a fix with the network team. I promise a follow-up within the hour.",
      competency: { name: "Customer focus", description: null, indicators: [] },
      engine: null,
      apiKey: null,
    });
    expect(r.score).toBeGreaterThan(30);
  });
});
