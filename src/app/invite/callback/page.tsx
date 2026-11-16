import { AuthShell } from "@/components/AuthShell";
import { getT } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { setupUserId } from "@/lib/setup-marker";
import { SetPasswordFlow } from "./SetPasswordFlow";

export const metadata = { title: "Set your password", robots: { index: false, follow: false } };

// The "choose a password" page: the first touch for invited people and the
// landing for password resets. The form appears only when this browser has
// just come through an email link for the signed-in account (see
// src/lib/setup-marker.ts). Links normally arrive via /auth/confirm; links in
// older formats are picked up by SetPasswordFlow.
export default async function InviteCallbackPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const [{ t }, { link }] = await Promise.all([getT(), searchParams]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The account this browser may set a password for, if any.
  const account = user && (await setupUserId()) === user.id ? user : null;

  // What /auth/confirm reported when the link could not be used.
  const linkProblem = link === "deactivated" ? "deactivated" : link === "expired" || link === "invalid" ? "expired" : null;

  return (
    <AuthShell title={t.auth.setPassword.title} subtitle={t.auth.setPassword.subtitle}>
      <SetPasswordFlow
        t={t}
        ready={!!account}
        email={account?.email || ""}
        signedInEmail={user?.email || ""}
        linkProblem={account ? null : linkProblem}
      />
    </AuthShell>
  );
}
