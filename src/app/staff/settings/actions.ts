"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "hr_admin" && profile.role !== "system_admin")) {
    redirect("/staff?error=" + encodeURIComponent("Only HR admins and the super admin can manage settings."));
  }
  return { supabase, userId: user.id };
}

export async function updateEmailTemplate(formData: FormData) {
  const { supabase, userId } = await requireAdmin();
  const subject = String(formData.get("subject") || "").trim();
  const bodyHtml = String(formData.get("body_html") || "").trim();

  if (!subject || !bodyHtml) {
    redirect("/staff/settings?error=" + encodeURIComponent("Subject and body are required."));
  }

  const { error } = await supabase
    .from("email_templates")
    .update({ subject, body_html: bodyHtml, updated_by: userId, updated_at: new Date().toISOString() })
    .eq("template_key", "candidate_invite");

  if (error) {
    redirect("/staff/settings?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/staff/settings");
  redirect("/staff/settings?saved=1");
}

export async function uploadEmailImage(formData: FormData) {
  const { supabase } = await requireAdmin();
  const file = formData.get("image") as File | null;

  if (!file || file.size === 0) {
    redirect("/staff/settings?error=" + encodeURIComponent("Choose an image file first."));
  }

  if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
    redirect("/staff/settings?error=" + encodeURIComponent("Only PNG or JPG images are supported."));
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `candidate-invite/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("email-assets").upload(path, file, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    redirect("/staff/settings?error=" + encodeURIComponent(uploadError.message));
  }

  const { data: pub } = supabase.storage.from("email-assets").getPublicUrl(path);

  const { error: dbError } = await supabase
    .from("email_templates")
    .update({ image_url: pub.publicUrl, updated_at: new Date().toISOString() })
    .eq("template_key", "candidate_invite");

  if (dbError) {
    redirect("/staff/settings?error=" + encodeURIComponent(dbError.message));
  }

  revalidatePath("/staff/settings");
  redirect("/staff/settings?saved=1");
}

export async function removeEmailImage() {
  const { supabase } = await requireAdmin();
  await supabase
    .from("email_templates")
    .update({ image_url: null, updated_at: new Date().toISOString() })
    .eq("template_key", "candidate_invite");
  revalidatePath("/staff/settings");
}

export async function updateEngineSettings(engineKey: "claude" | "fugu" | "kimi", formData: FormData) {
  const { supabase, userId } = await requireAdmin();

  const enabled = formData.get("enabled") === "on";
  const rawKey = String(formData.get("api_key") || "").trim();

  const update: Record<string, unknown> = {
    enabled,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  // Only overwrite the stored key if the admin typed a new one — leaves the existing
  // key in place when the field is left blank (it renders masked, never the real value).
  if (rawKey) update.api_key = rawKey;

  const { error } = await supabase.from("generation_engines").update(update).eq("key", engineKey);

  if (error) {
    redirect("/staff/settings?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/staff/settings");
  revalidatePath("/staff/builder");
  redirect("/staff/settings?saved=1");
}

export async function clearEngineKey(engineKey: "claude" | "fugu" | "kimi") {
  const { supabase, userId } = await requireAdmin();
  await supabase
    .from("generation_engines")
    .update({ api_key: null, enabled: false, updated_by: userId, updated_at: new Date().toISOString() })
    .eq("key", engineKey);
  revalidatePath("/staff/settings");
  revalidatePath("/staff/builder");
}
