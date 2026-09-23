import { describe, expect, it } from "vitest";
import { indicatorsForGeneration } from "./generation";

// Follow-up ask: "make sure built assessments are intermediate to advance,
// challenge candidates." indicatorsForGeneration is the structural half of
// that fix -- it strips "Basic"-tier behavioral indicators out of the
// grounding material handed to the generation prompt, so a case can't end up
// anchored on entry-level behavior even if the model under-weights the prose
// difficulty instruction.
describe("indicatorsForGeneration", () => {
  it("drops Basic-tier indicators when Skilled/Expert ones exist", () => {
    const indicators = [
      { level: "Basic", indicator_text: "entry-level behavior" },
      { level: "Skilled", indicator_text: "intermediate behavior" },
      { level: "Expert", indicator_text: "advanced behavior" },
    ];
    const result = indicatorsForGeneration(indicators);
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.level !== "Basic")).toBe(true);
  });

  it("falls back to Basic indicators when nothing else is on file", () => {
    const indicators = [{ level: "Basic", indicator_text: "entry-level behavior" }];
    const result = indicatorsForGeneration(indicators);
    expect(result).toEqual(indicators);
  });

  it("returns an empty array unchanged", () => {
    expect(indicatorsForGeneration([])).toEqual([]);
  });
});
