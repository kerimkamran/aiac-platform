import Link from "next/link";
import { signup } from "./actions";

export default async function SignupPage({
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

        <form action={signup} className="bg-white border rounded-lg shadow-sm p-6 space-y-4">
          <h1 className="text-lg font-semibold text-gray-900">Candidate sign up</h1>

          {error && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              type="text"
              name="full_name"
              required
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Jane Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-accent text-white rounded-md py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Create account
          </button>

          <p className="text-xs text-gray-500 text-center">
            Already have an account? <Link href="/login" className="text-accent font-medium">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
