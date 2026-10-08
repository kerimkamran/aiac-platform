import { describe, expect, it } from "vitest";
import { validateCases } from "./case-library";

const base = { title: "T", scenarioText: "S", questionStem: "Q", difficulty: "mid", methodologyTag: "Blended", methodologyNotes: "n" };

describe("validateCases", () => {
  it("keeps valid cases and reports the rest", () => {
    const { cases, dropped } = validateCases({
      cases: [
        { ...base, questionType: "mcq", options: [{ text: "a", correct: true }, { text: "b" }] },
        { ...base, title: "No answer", questionType: "mcq", options: [{ text: "a" }, { text: "b" }] },
        { ...base, title: "Text", questionType: "text" },
      ],
    });
    expect(cases.map((c) => c.title)).toEqual(["T", "Text"]);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]).toMatch(/No answer/);
  });
});
