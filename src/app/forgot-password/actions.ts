"use server";

import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Enter your email address." };

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vantage-ag.vercel.app";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/invite/callback`,
  });

  // Deliberately don't leak whether the email exists -- always show the same
  // success state, so this can't be used to enumerate registered accounts.
  if (error) {
    console.error("resetPasswordForEmail failed:", error.message);
  }

  return { ok: true };
}
