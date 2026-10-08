import { describe, expect, it } from "vitest";
import { checkTextBytes, cleanFileName, isAllowedTextName } from "./upload-text";

const enc = (s: string) => new TextEncoder().encode(s);

describe("checkTextBytes", () => {
  it("accepts UTF-8 markdown and trims it", () => {
    const r = checkTextBytes(enc("  # Sales playbook\nAzərbaycan dili ✓  \n"), "playbook.md");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe("# Sales playbook\nAzərbaycan dili ✓");
  });

  it("rejects files with NUL bytes (renamed images and office files)", () => {
    const r = checkTextBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d]), "photo.md");
    expect(r.ok).toBe(false);
  });

  it("rejects invalid UTF-8", () => {
    const r = checkTextBytes(new Uint8Array([0xff, 0xfe, 0xfd]), "legacy.txt");
    expect(r.ok).toBe(false);
  });

  it("rejects files over 200 KB and empty files", () => {
    expect(checkTextBytes(new Uint8Array(200 * 1024 + 1).fill(97), "big.md").ok).toBe(false);
    expect(checkTextBytes(enc("   \n "), "empty.md").ok).toBe(false);
  });
});

describe("file names", () => {
  it("only allows markdown and text uploads here", () => {
    expect(isAllowedTextName("notes.MD")).toBe(true);
    expect(isAllowedTextName("notes.txt")).toBe(true);
    expect(isAllowedTextName("notes.exe")).toBe(false);
    expect(isAllowedTextName("notes")).toBe(false);
  });

  it("strips path separators and control characters", () => {
    expect(cleanFileName("../../etc/passwd\u0000.md")).toBe("....etcpasswd.md");
  });
});
