import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { inviteRedirectUrl } from "@/lib/site-url";

/**
 * Sends Supabase's "set / reset your password" email. Used for invitations,
 * "Resend invite", reminders and "Forgot password".
 *
 * Why not the request's own Supabase client: @supabase/ssr clients use the
 * PKCE flow, which stores half of the link's secret as a cookie in the browser
 * that made the request. For an invitation that is the HR admin's browser, so
 * the link could never work on the invitee's own phone or laptop ("That link
 * has expired"). This client is not tied to any browser, so the emailed link
 * works wherever it is opened.
 *
 * Returns null on success, or Supabase's error message.
 */
export async function sendSetPasswordEmail(email: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return "Supabase is not configured.";

  const client = createSupabaseClient(url, anonKey, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // redirectTo is where Supabase's default email template sends people. The
  // templates in supabase/email-templates link to /auth/confirm instead.
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: inviteRedirectUrl() });
  return error ? error.message || "The email could not be sent." : null;
}
