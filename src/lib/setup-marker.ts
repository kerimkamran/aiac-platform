import "server-only";
import { cookies } from "next/headers";
import { siteUrl } from "@/lib/site-url";

// A short-lived note that this browser has just come through an email link for
// one particular account. The set-password page only shows its form while the
// note matches the signed-in user, so it can never quietly change the password
// of somebody who was already signed in (for example an HR admin who opens an
// invite link to test it).
//
// It is a convenience guard, not a security boundary: Supabase already lets any
// signed-in session change its own password.
const SETUP_COOKIE = "vantage_setup";
const MAX_AGE_SECONDS = 60 * 60;

function options(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: siteUrl().startsWith("https://"),
    // Only the set-password page and its actions need it.
    path: "/invite",
    maxAge,
  };
}

export async function markSetup(userId: string): Promise<void> {
  (await cookies()).set(SETUP_COOKIE, userId, options(MAX_AGE_SECONDS));
}

export async function setupUserId(): Promise<string | null> {
  return (await cookies()).get(SETUP_COOKIE)?.value || null;
}

export async function clearSetup(): Promise<void> {
  (await cookies()).set(SETUP_COOKIE, "", options(0));
}
