import Link from "next/link";
import { Icon } from "@/components/ui";
import { AuthPanel } from "@/components/auth-panel";

export const metadata = { title: "Invite only" };

export default function SignupPage() {
  return (
    <AuthPanel
      title="Accounts are invite-only"
      subtitle="AIAC candidate and reviewer accounts are created by your HR team — there's no public sign-up."
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 bg-background border border-line rounded-xl p-4">
          <span className="w-8 h-8 rounded-lg bg-brand/10 text-brand grid place-items-center shrink-0">
            <Icon name="shield" className="w-4 h-4" />
          </span>
          <p className="text-sm text-muted">
            If you were told to complete an assessment, check your inbox for an invitation email from Azerconnect
            Group with a link to set your password. Didn&apos;t get one? Ask your recruiter or HR contact to add you.
          </p>
        </div>
        <Link
          href="/login"
          className="w-full inline-flex items-center justify-center gap-2 bg-brand text-white rounded-xl py-3 text-sm font-semibold hover:bg-brand-light transition-colors"
        >
          Go to log in
          <Icon name="arrowRight" className="w-4 h-4" />
        </Link>
      </div>
    </AuthPanel>
  );
}
