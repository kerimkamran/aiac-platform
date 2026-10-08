import { describe, expect, it } from "vitest";
import { levelCalibration } from "./scoring";
import { LEVELS } from "./levels";

describe("levelCalibration", () => {
  it("adds nothing when the assessment has no target level", () => {
    expect(levelCalibration(null)).toBe("");
    expect(levelCalibration(undefined)).toBe("");
  });

  it("names the level and its bar for the scorer", () => {
    const text = levelCalibration("director");
    expect(text).toContain(LEVELS.director.label);
    expect(text).toContain(LEVELS.director.scoringBar);
    expect(text).toContain("Partially Meets");
  });
});
