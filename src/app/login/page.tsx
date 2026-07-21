import Link from "next/link";
import { login } from "./actions";
import { AuthPanel, Field } from "@/components/auth-panel";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthPanel
      title="Welcome back"
      subtitle="Log in to your candidate or staff workspace."
    >
      <form action={login} className="space-y-4">
        {error && (
          <p className="text-sm text-critical bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{error}</p>
        )}
        <Field label="Email" name="email" type="email" placeholder="you@company.com" />
        <Field label="Password" name="password" type="password" placeholder="••••••••" />
        <div className="text-right">
          <Link href="/forgot-password" className="text-[12.5px] text-accent-dark font-semibold hover:underline">
            Forgot password?
          </Link>
        </div>
        <button className="w-full bg-brand text-white rounded-xl py-3 text-sm font-semibold hover:bg-brand-light transition-colors">
          Log in
        </button>
        <p className="text-[13px] text-muted text-center">
          No account yet?{" "}
          <Link href="/signup" className="text-accent-dark font-semibold hover:underline">
            Accounts are invite-only
          </Link>
        </p>
      </form>
    </AuthPanel>
  );
}
