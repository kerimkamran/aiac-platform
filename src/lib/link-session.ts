import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { markSetup } from "@/lib/setup-marker";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// The last step after an email link has signed someone in, shared by every
// kind of link. A deactivated account is signed straight back out, the same
// rule the sign-in page applies, so the person is told at once instead of
// after choosing a password. Otherwise this browser is noted as having come
// through a link for that account (see setup-marker.ts).
export async function finishLinkSignIn(supabase: ServerClient, userId: string): Promise<"ok" | "deactivated"> {
  const { data: profile } = await supabase.from("profiles").select("status").eq("id", userId).maybeSingle();
  if (profile?.status === "deactivated") {
    await supabase.auth.signOut({ scope: "local" });
    return "deactivated";
  }
  await markSetup(userId);
  return "ok";
}
