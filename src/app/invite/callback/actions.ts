"use server";

import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/home";
import { isEmailLinkSession } from "@/lib/set-password-link";
import { finishLinkSignIn } from "@/lib/link-session";
import { clearSetup, setupUserId } from "@/lib/setup-marker";

export type AcceptLinkResult = { ok: true } | { ok: false; reason: "expired" | "deactivated" };

const EXPIRED: AcceptLinkResult = { ok: false, reason: "expired" };

// Links made by Supabase's default email template arrive with the session
// tokens in the address bar. After the person selects Continue, the browser
// hands them here, so the session and the "came through a link" note are both
// set by the server.
//
// Secrets reach these actions as FormData, never as plain arguments: in
// development Next.js prints every server action's plain arguments to the
// server log, but shows FormData only as {}.
export async function acceptLinkTokens(formData: FormData): Promise<AcceptLinkResult> {
  const accessToken = formData.get("access_token");
  const refreshToken = formData.get("refresh_token");
  if (typeof accessToken !== "string" || typeof refreshToken !== "string") return EXPIRED;
  if (!accessToken || !refreshToken || accessToken.length > 8192 || refreshToken.length > 1024) return EXPIRED;

  // Only a session that was just started from an email link is accepted
  // (not, for example, a password sign-in copied from someone's browser).
  // Checked before the session is touched, so a rejected link never changes
  // who is signed in.
  if (!isEmailLinkSession(accessToken, Math.floor(Date.now() / 1000))) return EXPIRED;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error || !data.user || !data.session) return EXPIRED;
    // The same check on the session actually issued (it differs from the one
    // handed in when the access token had to be refreshed).
    if (!isEmailLinkSession(data.session.access_token, Math.floor(Date.now() / 1000))) {
      await supabase.auth.signOut({ scope: "local" });
      return EXPIRED;
    }
    return (await finishLinkSignIn(supabase, data.user.id)) === "ok" ? { ok: true } : { ok: false, reason: "deactivated" };
  } catch {
    return EXPIRED;
  }
}

// A PKCE link (from an email sent before links were verified on the server).
// It can only be exchanged in the browser that asked for it; anywhere else
// this reports failure and the page offers a new link.
export async function acceptLinkCode(code: string): Promise<AcceptLinkResult> {
  if (typeof code !== "string" || !code || code.length > 512) return EXPIRED;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return EXPIRED;
    return (await finishLinkSignIn(supabase, data.user.id)) === "ok" ? { ok: true } : { ok: false, reason: "deactivated" };
  } catch {
    return EXPIRED;
  }
}

export type SavePasswordResult =
  | { ok: true; destination: string }
  | { ok: false; error: "link" | "timedOut" | "short" | "mismatch" | "same" | "weak" | "deactivated" | "failed" };

export async function savePassword(formData: FormData): Promise<SavePasswordResult> {
  const password = formData.get("password");
  const confirm = formData.get("confirm");
  if (typeof password !== "string" || typeof confirm !== "string") return { ok: false, error: "failed" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Only for the account whose email link was just opened in this browser.
  // Signed in but no matching note means the page was left open too long.
  if (!user) return { ok: false, error: "link" };
  if ((await setupUserId()) !== user.id) return { ok: false, error: "timedOut" };

  if (password.length < 8) return { ok: false, error: "short" };
  if (password !== confirm) return { ok: false, error: "mismatch" };

  const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", user.id).maybeSingle();
  if (profile?.status === "deactivated") {
    await supabase.auth.signOut({ scope: "local" });
    await clearSetup();
    return { ok: false, error: "deactivated" };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const code = (error.code || "").toLowerCase();
    const message = (error.message || "").toLowerCase();
    if (code === "same_password" || message.includes("different from the old")) return { ok: false, error: "same" };
    if (code === "weak_password" || message.includes("weak")) return { ok: false, error: "weak" };
    return { ok: false, error: "failed" };
  }

  await clearSetup();
  return { ok: true, destination: homeFor(profile?.role) };
}
