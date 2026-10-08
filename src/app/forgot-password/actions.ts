"use server";

import { createClient } from "@/lib/supabase/server";
import { inviteRedirectUrl } from "@/lib/site-url";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Enter your email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: inviteRedirectUrl(),
  });

  // Deliberately don't leak whether the email exists -- always show the same
  // success state, so this can't be used to enumerate registered accounts.
  if (error) {
    console.error("resetPasswordForEmail failed:", error.message);
  }

  return { ok: true };
}
