"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon, Logo } from "@/components/ui";

export default function InviteCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "saving" | "done">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "ready" : "invalid");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && status === "checking")) {
        setStatus("ready");
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setStatus("saving");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setStatus("ready");
      return;
    }
    setStatus("done");
    setTimeout(() => router.push("/candidate"), 1400);
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-5">
      <div className="w-full max-w-sm anim-fade-up">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        {status === "checking" && (
          <p className="text-center text-sm text-muted">Verifying your invitation…</p>
        )}

        {status === "invalid" && (
          <div className="text-center">
            <p className="font-semibold text-foreground">This invite link is invalid or has expired</p>
            <p className="text-sm text-muted mt-2">Ask your recruiter to resend your invitation.</p>
          </div>
        )}

        {(status === "ready" || status === "saving") && (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-foreground text-center [font-family:var(--font-display)]">
              Set your password
            </h1>
            <p className="text-sm text-muted mt-2 mb-8 text-center">
              Welcome to AIAC — choose a password to finish setting up your account.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-critical bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{error}</p>
              )}
              <div>
                <label className="block text-[13px] font-semibold text-foreground mb-1.5">New password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-shadow"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-foreground mb-1.5">Confirm password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Retype your password"
                  className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-shadow"
                />
              </div>
              <button
                disabled={status === "saving"}
                className="w-full bg-brand text-white rounded-xl py-3 text-sm font-semibold hover:bg-brand-light transition-colors disabled:opacity-60"
              >
                {status === "saving" ? "Saving…" : "Set password & continue"}
              </button>
            </form>
          </>
        )}

        {status === "done" && (
          <div className="text-center">
            <span className="mx-auto w-12 h-12 rounded-2xl bg-accent-soft text-accent-dark grid place-items-center mb-4">
              <Icon name="check" className="w-6 h-6" />
            </span>
            <p className="font-semibold text-foreground">Password set — redirecting…</p>
          </div>
        )}
      </div>
    </div>
  );
}
