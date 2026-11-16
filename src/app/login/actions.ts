"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/authz";
import { homeFor, safeNextPath } from "@/lib/home";

// Maps what Supabase returns to a short code; the sign-in page turns the code
// into a friendly message in the visitor's language. Raw provider messages are
// never shown (Clear Horizon plan, section 10).
function errorCode(err: { message?: string; code?: string; status?: number }): string {
  const code = (err.code || "").toLowerCase();
  const msg = (err.message || "").toLowerCase();
  if (err.status === 429 || code.includes("rate_limit") || msg.includes("rate limit") || msg.includes("too many")) return "too-many";
  if (code === "invalid_credentials" || msg.includes("invalid login") || msg.includes("invalid credentials")) return "wrong-password";
  if (msg.includes("expired")) return "expired";
  return "generic";
}

function loginUrl(error: string, next: string | null) {
  const q = new URLSearchParams({ error });
  if (next) q.set("next", next);
  return `/login?${q.toString()}`;
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = safeNextPath(String(formData.get("next") || ""));

  if (!email || !password) redirect(loginUrl("missing", next));

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(loginUrl(errorCode(error), next));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user!.id)
    .single();

  if (profile?.status === "deactivated") {
    await supabase.auth.signOut();
    redirect(loginUrl("deactivated", null));
  }

  await logAudit({ module: "auth", action: "login", targetType: "user", targetId: user!.id });

  // A deep link survives sign-in: an emailed link to an assessment returns you
  // there. It was validated above, so it can only be a path on this site.
  redirect(next ?? homeFor(profile?.role));
}
