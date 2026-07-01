import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="font-semibold text-brand text-lg">
            AI Assessment Center <span className="text-accent">by AG</span>
          </Link>
        </div>

        <form action={login} className="bg-white border rounded-lg shadow-sm p-6 space-y-4">
          <h1 className="text-lg font-semibold text-gray-900">Log in</h1>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              required
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-brand text-white rounded-md py-2.5 text-sm font-semibold hover:bg-brand-light transition-colors"
          >
            Log in
          </button>

          <p className="text-xs text-gray-500 text-center">
            No account? <Link href="/signup" className="text-accent font-medium">Sign up</Link>
          </p>
        </form>

        <div className="mt-6 bg-gray-50 border rounded-lg p-4 text-xs text-gray-600 space-y-1">
          <p className="font-semibold text-gray-700">Demo accounts</p>
          <p>Candidate: candidate@aiac-demo.com / Demo12345!</p>
          <p>HR Admin / Recruiter: recruiter@aiac-demo.com / Demo12345!</p>
        </div>
      </div>
    </div>
  );
}
