import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { ButtonLink } from "@/components/ui/Button";
import { Timeline } from "@/components/ui/Timeline";
import { getT } from "@/i18n/server";

export const metadata = { title: "Invitation help" };

// The old "Accounts are invite-only" dead end, turned into a way in: three
// steps to find the email, open the link and choose a password.
export default async function InvitationHelpPage() {
  const { t } = await getT();
  const inv = t.auth.invitation;
  return (
    <AuthShell title={inv.title} subtitle={inv.subtitle}>
      <Timeline steps={inv.steps.map((s) => ({ label: s.t, detail: s.b, state: "todo" as const }))} />
      <p className="text-sm text-muted mt-6">{inv.expired}</p>
      <div className="mt-6 space-y-3">
        <ButtonLink href="/login" size="lg" block>
          {t.common.signIn}
        </ButtonLink>
        <p className="text-center">
          <Link href="/forgot-password" className="text-sm font-semibold text-accent hover:underline">
            {t.common.forgot}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
