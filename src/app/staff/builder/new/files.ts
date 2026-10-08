"use client";

import { isAllowedTextName, extensionOf, checkTextBytes } from "@/lib/upload-text";
import { extractDocxText } from "../positions/actions";

// Reads a .md or .txt file in the browser, with the same limits the server applies.
export async function readTextFile(file: File): Promise<{ ok: true; name: string; text: string } | { ok: false; error: string }> {
  if (!isAllowedTextName(file.name)) return { ok: false, error: "Use .md or .txt for reference files. For job descriptions, .docx is also accepted." };
  const check = checkTextBytes(new Uint8Array(await file.arrayBuffer()), file.name);
  if (!check.ok) return check;
  return { ok: true, name: check.name, text: check.text };
}

// Reads a .docx job description on the server, since it needs a parser.
export async function readDocxText(file: File): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (extensionOf(file.name) !== ".docx") return { ok: false, error: "Choose a .docx file." };
  const fd = new FormData();
  fd.set("file", file);
  const result = await extractDocxText(fd);
  return result.ok ? { ok: true, text: result.text } : { ok: false, error: result.error };
}
