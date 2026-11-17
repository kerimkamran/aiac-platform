import { describe, expect, it } from "vitest";
import { LEVEL_KEYS, LEVELS, levelLabelFor } from "./levels";

describe("levelLabelFor", () => {
  it("keeps the English label for English and unknown languages", () => {
    for (const k of LEVEL_KEYS) {
      expect(levelLabelFor(k, "en")).toBe(LEVELS[k].label);
      expect(levelLabelFor(k, "xx")).toBe(LEVELS[k].label);
    }
  });

  it("has a different, non-empty label for every level in Azerbaijani and Russian", () => {
    for (const lang of ["az", "ru"]) {
      const labels = LEVEL_KEYS.map((k) => levelLabelFor(k, lang));
      expect(new Set(labels).size).toBe(LEVEL_KEYS.length);
      expect(labels.every((l) => l.trim().length > 0)).toBe(true);
    }
  });
});
