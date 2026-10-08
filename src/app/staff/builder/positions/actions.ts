"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/authz";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { JD_MAX_CHARS, MAX_REFERENCE_FILES, NOTES_MAX_CHARS } from "@/lib/ai-context";
import { isLevelKey, type LevelKey } from "@/lib/levels";
import {
  checkTextBytes,
  cleanFileName,
  DOCX_EXTENSION,
  DOCX_MAX_BYTES,
  extensionOf,
  isAllowedTextName,
  type UploadCheck,
} from "@/lib/upload-text";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) || "").trim();
}

type PositionFields = {
  title: string;
  department: string | null;
  default_level: LevelKey;
  job_description: string;
  notes: string;
};

function validatePositionFields(formData: FormData): PositionFields | { error: string } {
  const title = str(formData, "title");
  const department = str(formData, "department") || null;
  const levelRaw = str(formData, "default_level");
  const jobDescription = String(formData.get("job_description") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  if (title.length < 2 || title.length > 120) return { error: "The position title must be between 2 and 120 characters." };
  if (!isLevelKey(levelRaw)) return { error: "Choose a default level." };
  if (jobDescription.length > JD_MAX_CHARS) return { error: `The job description is too long (limit ${JD_MAX_CHARS.toLocaleString()} characters).` };
  if (notes.length > NOTES_MAX_CHARS) return { error: `The notes are too long (limit ${NOTES_MAX_CHARS.toLocaleString()} characters).` };
  return { title, department, default_level: levelRaw, job_description: jobDescription, notes };
}

export async function createPosition(formData: FormData) {
  const profile = await requireStaff();
  const fields = validatePositionFields(formData);
  if ("error" in fields) redirect("/staff/builder/positions/new?error=" + encodeURIComponent(fields.error));

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  const { data, error } = await supabase
    .from("positions")
    .insert({ ...fields, organization_id: org?.id, created_by: profile.id, updated_by: profile.id })
    .select("id")
    .single();
  if (error || !data) {
    const message = error?.message.includes("positions_title_active")
      ? "A position with that title already exists."
      : error?.message || "Couldn't create the position.";
    redirect("/staff/builder/positions/new?error=" + encodeURIComponent(message));
  }
  revalidatePath("/staff/builder/positions");
  redirect(`/staff/builder/positions/${data.id}?added=${encodeURIComponent("Position created.")}`);
}

export async function updatePosition(positionId: string, formData: FormData) {
  const profile = await requireStaff();
  const fields = validatePositionFields(formData);
  if ("error" in fields) redirect(`/staff/builder/positions/${positionId}?error=` + encodeURIComponent(fields.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("positions")
    .update({ ...fields, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", positionId);
  if (error) {
    const message = error.message.includes("positions_title_active")
      ? "Another active position already has that title."
      : error.message;
    redirect(`/staff/builder/positions/${positionId}?error=` + encodeURIComponent(message));
  }
  revalidatePath(`/staff/builder/positions/${positionId}`);
  revalidatePath("/staff/builder/positions");
  redirect(`/staff/builder/positions/${positionId}?added=${encodeURIComponent("Position saved.")}`);
}

export async function setPositionArchived(positionId: string, archived: boolean) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("positions")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", positionId);
  if (error) redirect(`/staff/builder/positions/${positionId}?error=` + encodeURIComponent(error.message));
  revalidatePath("/staff/builder/positions");
  redirect(archived ? "/staff/builder/positions?added=" + encodeURIComponent("Position archived.") : `/staff/builder/positions/${positionId}`);
}

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

// Adds one .md/.txt reference file to a position (at most MAX_REFERENCE_FILES).
export async function addPositionFile(positionId: string, formData: FormData) {
  const profile = await requireStaff();
  const file = formData.get("file");
  const back = `/staff/builder/positions/${positionId}`;
  if (!(file instanceof File)) redirect(`${back}?error=` + encodeURIComponent("Choose a file to upload."));

  const name = cleanFileName(file.name);
  if (!isAllowedTextName(name)) redirect(`${back}?error=` + encodeURIComponent("Reference files must be .md or .txt. Use the Word option for .docx job descriptions."));

  const check = checkTextBytes(new Uint8Array(await file.arrayBuffer()), name);
  if (!check.ok) redirect(`${back}?error=` + encodeURIComponent(check.error));

  const supabase = await createClient();
  const { count } = await supabase
    .from("position_files")
    .select("id", { count: "exact", head: true })
    .eq("position_id", positionId);
  if ((count ?? 0) >= MAX_REFERENCE_FILES) {
    redirect(`${back}?error=` + encodeURIComponent(`A position can have at most ${MAX_REFERENCE_FILES} reference files. Remove one first.`));
  }

  const { error } = await supabase.from("position_files").insert({
    position_id: positionId,
    filename: check.name,
    content_text: check.text,
    size_bytes: new TextEncoder().encode(check.text).length,
    created_by: profile.id,
  });
  if (error) redirect(`${back}?error=` + encodeURIComponent(error.message));
  revalidatePath(back);
  redirect(`${back}?added=${encodeURIComponent(`Added ${check.name}.`)}`);
}

export async function removePositionFile(positionId: string, fileId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("position_files").delete().eq("id", fileId).eq("position_id", positionId);
  if (error) redirect(`/staff/builder/positions/${positionId}?error=` + encodeURIComponent(error.message));
  revalidatePath(`/staff/builder/positions/${positionId}`);
}

// Loads a position's saved job description, notes and reference files for the
// new-assessment form. Called when a position is picked, so the page does not
// have to carry every position's text up front.
export async function loadPositionContext(positionId: string): Promise<{
  jobDescription: string;
  notes: string;
  files: { name: string; text: string }[];
}> {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: position }, { data: files }] = await Promise.all([
    supabase.from("positions").select("job_description, notes").eq("id", positionId).maybeSingle(),
    supabase.from("position_files").select("filename, content_text").eq("position_id", positionId).order("created_at"),
  ]);
  return {
    jobDescription: position?.job_description ?? "",
    notes: position?.notes ?? "",
    files: (files || []).map((f) => ({ name: f.filename, text: f.content_text })),
  };
}
