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
        <button className="w-full bg-brand text-white rounded-xl py-3 text-sm font-semibold hover:bg-brand-light transition-colors">
          Log in
        </button>
        <p className="text-[13px] text-muted text-center">
          No account yet?{" "}
          <Link href="/signup" className="text-accent-dark font-semibold hover:underline">
            Sign up as a candidate
          </Link>
        </p>
      </form>

      <div className="mt-6 bg-background border border-line rounded-xl p-4 text-xs text-muted space-y-1.5">
        <p className="font-bold text-foreground uppercase tracking-wide text-[10px]">Demo accounts</p>
        <p>
          <span className="font-semibold text-foreground">Candidate:</span> candidate@aiac-demo.com · Demo12345!
        </p>
        <p>
          <span className="font-semibold text-foreground">Recruiter / HR:</span> recruiter@aiac-demo.com · Demo12345!
        </p>
      </div>
    </AuthPanel>
  );
}
