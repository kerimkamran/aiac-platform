// Rules for text that staff upload as job descriptions or reference files.
// The rules are checked on the server; the client reads the same limits to
// give early feedback.

import { REFERENCE_FILE_MAX_CHARS } from "@/lib/ai-context";

export const TEXT_EXTENSIONS = [".md", ".txt"] as const;
export const DOCX_EXTENSION = ".docx";
export const DOCX_MAX_BYTES = 5 * 1024 * 1024;

export type UploadCheck = { ok: true; text: string; name: string } | { ok: false; error: string };

export function cleanFileName(raw: string): string {
  return raw.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().slice(0, 120) || "file";
}

// Accepts plain UTF-8 text. Rejects anything that decodes with errors or looks
// binary (NUL bytes), which covers renamed images and office files.
export function checkTextBytes(bytes: Uint8Array, name: string): UploadCheck {
  if (bytes.byteLength > REFERENCE_FILE_MAX_CHARS) {
    return { ok: false, error: `"${name}" is larger than 200 KB. Split it or shorten it.` };
  }
  if (bytes.includes(0)) {
    return { ok: false, error: `"${name}" doesn't look like a text file.` };
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, error: `"${name}" isn't UTF-8 text. Save it as UTF-8 and try again.` };
  }
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: `"${name}" is empty.` };
  return { ok: true, text: trimmed, name: cleanFileName(name) };
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export function isAllowedTextName(name: string): boolean {
  return (TEXT_EXTENSIONS as readonly string[]).includes(extensionOf(name));
}
