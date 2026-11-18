import { describe, expect, it } from "vitest";
import { EXCEL_COPY } from "./excel-copy";
import { DECISION_OPTIONS } from "./purpose";

describe("Excel export wording", () => {
  it("has the same keys in every language", () => {
    for (const lang of ["az", "ru"] as const) {
      expect(Object.keys(EXCEL_COPY[lang].headers).sort()).toEqual(Object.keys(EXCEL_COPY.en.headers).sort());
      expect(Object.keys(EXCEL_COPY[lang].status).sort()).toEqual(Object.keys(EXCEL_COPY.en.status).sort());
      expect(Object.keys(EXCEL_COPY[lang].decision).sort()).toEqual(Object.keys(EXCEL_COPY.en.decision).sort());
    }
  });

  it("names every decision the app can record", () => {
    const all = Object.values(DECISION_OPTIONS).flat().map((o) => o.v);
    for (const v of all) expect(EXCEL_COPY.en.decision[v], v).toBeTruthy();
  });

  it("uses sheet names Excel accepts", () => {
    for (const c of Object.values(EXCEL_COPY)) {
      expect(c.sheet.length).toBeLessThanOrEqual(31);
      expect(c.sheet).not.toMatch(/[\\/?*[\]:]/);
    }
  });
});
