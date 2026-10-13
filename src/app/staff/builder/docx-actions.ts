"use server";

import { requireStaff } from "@/lib/authz";
import { checkTextBytes, cleanFileName, DOCX_EXTENSION, DOCX_MAX_BYTES, extensionOf, type UploadCheck } from "@/lib/upload-text";

// Reads an uploaded .docx into plain text. Used for job descriptions, which
// are often Word files. The text is checked the same way as .md/.txt.
export async function extractDocxText(formData: FormData): Promise<UploadCheck> {
  await requireStaff();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a file to upload." };
  const name = cleanFileName(file.name);
  if (extensionOf(name) !== DOCX_EXTENSION) return { ok: false, error: "Only .docx files can be read here." };
  if (file.size > DOCX_MAX_BYTES) return { ok: false, error: `"${name}" is larger than 5 MB.` };
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return checkTextBytes(new TextEncoder().encode(value), name);
}
