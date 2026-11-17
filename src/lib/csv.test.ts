import { describe, expect, it } from "vitest";
import { csvCell, csvLine, decodeCsvBytes, parseCsv } from "./csv";

describe("csvCell", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("x\ny")).toBe('"x\ny"');
  });
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });
  it("keeps ordinary values", () => {
    expect(csvCell("Əli Məmmədov")).toBe("Əli Məmmədov");
    expect(csvLine(["a", null, 3])).toBe("a,,3");
  });
});

describe("parseCsv", () => {
  it("reads a comma file with a byte-order mark", () => {
    expect(parseCsv("﻿full_name,email\nJane,jane@x.az\n")).toEqual([
      ["full_name", "email"],
      ["Jane", "jane@x.az"],
    ]);
  });
  it("reads a semicolon file", () => {
    expect(parseCsv("full_name;email;department\r\nJane;jane@x.az;Ops")).toEqual([
      ["full_name", "email", "department"],
      ["Jane", "jane@x.az", "Ops"],
    ]);
  });
  it("keeps quoted commas and skips blank lines", () => {
    expect(parseCsv('name,email\n"Doe, Jane",j@x.az\n\n')).toEqual([
      ["name", "email"],
      ["Doe, Jane", "j@x.az"],
    ]);
  });
});

describe("decodeCsvBytes", () => {
  it("reads UTF-8 as is", () => {
    expect(decodeCsvBytes(new TextEncoder().encode("Əli,ali@example.az"))).toBe("Əli,ali@example.az");
  });
  it("falls back to Windows-1251 for files saved by older Excel", () => {
    // "Иван" in Windows-1251
    expect(decodeCsvBytes(new Uint8Array([0xc8, 0xe2, 0xe0, 0xed]))).toBe("Иван");
  });
});
