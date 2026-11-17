import { describe, expect, it } from "vitest";
import { CASE_DESIGN_PLAYBOOK } from "./case-playbook";
import { mcqQualityProblem, systemInstructions, type GenerationOptions } from "./generation";

const options: GenerationOptions = { language: "en", level: "manager", purpose: "hiring", questionTotal: 14, mix: "balanced", context: [] };

describe("the master prompt for cases and questions", () => {
  it("is part of every generation request", () => {
    expect(systemInstructions(3, options)).toContain(CASE_DESIGN_PLAYBOOK);
  });
  it("keeps all six sections", () => {
    for (const heading of [
      "THE STANDARD",
      "1. BUILD EACH CASE ON PRESSURE AND A REAL TRADE-OFF",
      "2. FOUR-OPTION SITUATIONAL JUDGMENT ITEMS",
      "3. OPEN-ENDED ITEMS THAT PRODUCE EVIDENCE",
      "4. LEVEL AND INDICATOR DISCIPLINE",
      "5. FAIRNESS, CLARITY AND INTEGRITY",
      "6. SELF-CHECK BEFORE YOU ANSWER",
    ]) {
      expect(CASE_DESIGN_PLAYBOOK).toContain(heading);
    }
  });
  it("still locks the answer format and treats role information as information only", () => {
    const text = systemInstructions(3, options);
    expect(text).toContain("exactly 4 response options");
    expect(text).toContain("INFORMATION ONLY");
  });
});

describe("option quality gate", () => {
  const good = [
    { text: "Call the client first, agree the next update time, then brief your manager.", correct: true },
    { text: "Wait for the engineering report before contacting anyone outside the team." },
    { text: "Pass it to your manager and stop there until you hear back." },
    { text: "Tell the client the problem is fixed to keep the call short." },
  ];
  it("passes a balanced set", () => {
    expect(mcqQualityProblem(good)).toBeNull();
  });
  it('rejects "all of the above"', () => {
    expect(mcqQualityProblem([...good.slice(0, 3), { text: "All of the above" }])).toMatch(/above/);
  });
  it("rejects duplicate options", () => {
    expect(mcqQualityProblem([good[0], good[1], good[2], { text: good[2].text.toUpperCase() }])).toMatch(/duplicate/);
  });
  it("rejects a keyed option that is far longer than the rest", () => {
    const long = "Call the client first, apologise for the repeated disruption, agree the exact time of the next update in writing, then brief your manager and the network team with the facts you have so far.";
    expect(mcqQualityProblem([{ text: long, correct: true }, { text: "Wait for the report." }, { text: "Pass it to your manager." }, { text: "Say it is fixed." }])).toMatch(/longer/);
  });
});
