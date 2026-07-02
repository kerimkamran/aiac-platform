import Link from "next/link";
import { signup } from "./actions";
import { AuthPanel, Field } from "@/components/auth-panel";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthPanel
      title="Create your candidate account"
      subtitle="Sign up with the email your recruiter has — invitations are matched by email address."
    >
      <form action={signup} className="space-y-4">
        {error && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">{error}</p>
        )}
        <Field label="Full name" name="full_name" type="text" placeholder="Leyla Mammadova" />
        <Field label="Email" name="email" type="email" placeholder="you@example.com" />
        <Field label="Password" name="password" type="password" placeholder="At least 6 characters" minLength={6} />
        <button className="w-full bg-accent text-white rounded-xl py-3 text-sm font-semibold hover:bg-accent-dark transition-colors">
          Create account
        </button>
        <p className="text-[13px] text-muted text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-accent-dark font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </AuthPanel>
  );
}
