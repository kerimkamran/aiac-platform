"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Skeleton } from "@/components/ui/Skeleton";
import { homeFor } from "@/lib/home";
import type { Dict } from "@/i18n/dictionaries";

// Set password (the first touch for candidates, and the landing for password
// resets): a live "at least 8 characters" check, a match check, and on success
// the horizon draws and "You're all set" appears before the person continues
// to their own home.
export function SetPasswordFlow({ t }: { t: Dict }) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "saving" | "done">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [destination, setDestination] = useState("/candidate");

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

  const longEnough = password.length >= 8;
  const mismatch = confirm.length > 0 && password !== confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!longEnough || password !== confirm) return;
    setStatus("saving");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(t.auth.errors.generic);
      setStatus("ready");
      return;
    }

    // Route by the account's actual role: this page is also where staff and
    // admin password resets land.
    let dest = "/candidate";
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      dest = homeFor(profile?.role);
    }
    setDestination(dest);
    setStatus("done");
  }

  if (status === "checking") {
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <span className="sr-only">…</span>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="space-y-5">
        <Callout tone="warning" role="alert">
          {t.auth.errors.expired}
        </Callout>
        <Link href="/forgot-password" className="inline-flex items-center min-h-11 text-sm font-semibold text-accent hover:underline">
          {t.auth.reset.title}
        </Link>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div role="status" className="text-center py-2">
        <svg viewBox="0 0 240 40" className="mx-auto w-60 h-10" aria-hidden>
          <line x1="0" y1="20" x2="240" y2="20" stroke="var(--line)" strokeWidth="2" />
          <line className="anim-grow-x" x1="0" y1="20" x2="240" y2="20" stroke="url(#sp-h)" strokeWidth="2" style={{ transformBox: "fill-box" }} />
          <defs>
            <linearGradient id="sp-h" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="240" y2="0">
              <stop offset="0" className="horizon-stop-from" />
              <stop offset="1" className="horizon-stop-to" />
            </linearGradient>
          </defs>
          <circle className="anim-seal-pop" cx="120" cy="20" r="8" style={{ fill: "var(--horizon-to)" }} />
        </svg>
        <p className="text-headline text-foreground mt-4">{t.auth.setPassword.doneTitle}</p>
        <p className="text-base text-muted mt-1">{t.auth.setPassword.doneBody}</p>
        <Button size="lg" block className="mt-6" onClick={() => router.push(destination)}>
          {t.common.continue}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <Callout tone="critical" role="alert">
          {error}
        </Callout>
      )}
      <PasswordField
        label={t.auth.setPassword.newPassword}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        fieldSize="lg"
        showLabel={t.common.show}
        hideLabel={t.common.hide}
        hint={<span className={longEnough ? "text-good" : undefined}>{longEnough ? t.auth.setPassword.ruleMet : t.auth.setPassword.rule}</span>}
      />
      <PasswordField
        label={t.auth.setPassword.confirm}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        fieldSize="lg"
        showLabel={t.common.show}
        hideLabel={t.common.hide}
        error={mismatch ? t.auth.setPassword.mismatch : undefined}
      />
      <Button type="submit" size="lg" block pending={status === "saving"} pendingLabel={t.auth.setPassword.pending} disabled={!longEnough || password !== confirm}>
        {t.auth.setPassword.save}
      </Button>
    </form>
  );
}
