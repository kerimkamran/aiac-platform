"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isTokenHash, parseLinkType } from "@/lib/set-password-link";
import { finishLinkSignIn } from "@/lib/link-session";

// Verifies an emailed link on the server. Unlike a PKCE code, a token hash
// needs nothing stored in the browser, so the link works on whatever device
// the person opens their email on. On success the session cookies are set and
// the person goes on to choose a password.
export async function confirmLink(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") || "").trim();
  const type = parseLinkType(String(formData.get("type") || ""));
  if (!isTokenHash(tokenHash) || !type) redirect("/invite/callback?link=invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) redirect("/invite/callback?link=expired");

  if ((await finishLinkSignIn(supabase, data.user.id)) === "deactivated") redirect("/invite/callback?link=deactivated");
  redirect("/invite/callback");
}
