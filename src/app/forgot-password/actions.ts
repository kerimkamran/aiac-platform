"use server";

import { sendSetPasswordEmail } from "@/lib/supabase/mailer";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) return { error: "Enter your email address." };

  const error = await sendSetPasswordEmail(email);

  // Deliberately don't leak whether the email exists -- always show the same
  // success state, so this can't be used to enumerate registered accounts.
  if (error) {
    console.error("Password reset email failed:", error);
  }

  return { ok: true };
}
