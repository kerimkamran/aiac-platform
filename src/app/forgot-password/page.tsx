"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthPanel, Field } from "@/components/auth-panel";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function handleSubmit(formData: FormData) {
    setStatus("sending");
    await requestPasswordReset(formData);
    setStatus("sent");
  }

  return (
    <AuthPanel
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to set a new password."
    >
      {status === "sent" ? (
        <div className="space-y-4">
          <p className="text-sm text-foreground bg-accent-soft border border-line rounded-xl px-3.5 py-3">
            If an account exists for that email, a reset link is on its way. Check your inbox (and spam
            folder) — the link is valid for a limited time.
          </p>
          <Link
            href="/login"
            className="block text-center text-[13px] text-accent-dark font-semibold hover:underline"
          >
            Back to log in
          </Link>
        </div>
      ) : (
        <form action={handleSubmit} className="space-y-4">
          <Field label="Email" name="email" type="email" placeholder="you@company.com" />
          <button
            disabled={status === "sending"}
            className="w-full bg-brand text-white rounded-xl py-3 text-sm font-semibold hover:bg-brand-light transition-colors disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Send reset link"}
          </button>
          <p className="text-[13px] text-muted text-center">
            <Link href="/login" className="text-accent-dark font-semibold hover:underline">
              Back to log in
            </Link>
          </p>
        </form>
      )}
    </AuthPanel>
  );
}
