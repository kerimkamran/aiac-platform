"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { readIncomingLink, readTokenClaims } from "@/lib/set-password-link";
import type { Dict } from "@/i18n/dictionaries";
import { acceptLinkCode, acceptLinkTokens, savePassword, type AcceptLinkResult, type SavePasswordResult } from "./actions";

type Failure = Extract<SavePasswordResult, { ok: false }>["error"];

// Set password (the first touch for invited people, and the landing for
// password resets): a live "at least 8 characters" check, a match check, and
// on success "You're all set" before the person continues to their own home.
//
// `ready` comes from the server and means this browser has just come through
// an email link for the signed-in account. This component first looks at the
// address bar: a link in an older format is handed to the server (and wins
// over any earlier link); with nothing there it shows the form when `ready`,
// and otherwise explains what to do.
//
// A link with sign-in tokens in the address bar is never used on its own:
// like /auth/confirm, the page names the account and waits for Continue, so a
// link crafted by someone else cannot quietly sign this browser into their
// account.
export function SetPasswordFlow({
  t,
  ready,
  email,
  signedInEmail,
  linkProblem,
}: {
  t: Dict;
  ready: boolean;
  email: string;
  signedInEmail: string;
  linkProblem: "expired" | "deactivated" | null;
}) {
  const router = useRouter();
  // "checking" until the address bar has been looked at. A link that has just
  // been opened always wins over an earlier one: "clear" (nothing left to
  // process, show the form if the server says ready), "expired" (the link
  // failed), "deactivated" (the account is closed) or "none" (no link at all).
  const [linkState, setLinkState] = useState<"checking" | "confirm" | "clear" | "expired" | "deactivated" | "none">("checking");
  // Sign-in tokens from the address bar, kept only in memory until Continue.
  const [pendingTokens, setPendingTokens] = useState<{ accessToken: string; refreshToken: string; email: string } | null>(null);
  const [opening, setOpening] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  // An email link works once, so it must be handed over once, even when React
  // runs effects twice in development.
  const linkHandled = useRef(false);

  useEffect(() => {
    if (linkHandled.current) return;
    linkHandled.current = true;

    void (async () => {
      // Wait for the rest of the page's effects first. The Next.js router
      // starts tracking address-bar changes in one of them; a change made
      // before that is undone by the router the next time it re-renders, which
      // would put the sign-in tokens back in the address bar.
      await Promise.resolve();

      const link = readIncomingLink(window.location.hash, window.location.search);
      if (link.kind === "none") {
        setLinkState(ready ? "clear" : (linkProblem ?? "none"));
        return;
      }

      // Never leave sign-in tokens in the address bar or the browser history.
      window.history.replaceState(null, "", window.location.pathname);

      if (link.kind === "tokens") {
        // Wait for Continue (see the note above the component).
        setPendingTokens({
          accessToken: link.accessToken,
          refreshToken: link.refreshToken,
          email: readTokenClaims(link.accessToken)?.email || "",
        });
        setLinkState("confirm");
        return;
      }

      let result: AcceptLinkResult = { ok: false, reason: "expired" };
      try {
        if (link.kind === "code") result = await acceptLinkCode(link.code);
      } catch {
        // Could not reach the server: treated like a link that did not work.
      }
      settleLink(result);
    })();
    // Runs once: `ready` and `linkProblem` are read as they were when the page
    // opened, and the ref above keeps a second run from doing anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whether the server has said "ready" at any point. Adjusted during render,
  // React's pattern for state that follows a prop.
  const [wasReady, setWasReady] = useState(ready);
  if (ready && !wasReady) setWasReady(true);

  // The server accepted the link, so the form should follow within a moment.
  // If it never does, say so instead of showing a loading state for ever.
  // (A browser that refuses cookies is not caught here: the form still shows,
  // and saving then reports the link as expired, because no session reached
  // the server.)
  useEffect(() => {
    if (linkState !== "clear" || ready || wasReady) return;
    const timer = window.setTimeout(() => setLinkState("expired"), 8000);
    return () => window.clearTimeout(timer);
  }, [linkState, ready, wasReady]);

  // What happens once the server has looked at a link.
  function settleLink(result: AcceptLinkResult) {
    if (result.ok) {
      // The server now knows this browser came through the link; re-render
      // so it sends the form for that account.
      router.refresh();
      setLinkState("clear");
    } else {
      setLinkState(result.reason);
    }
  }

  async function openLink() {
    if (!pendingTokens || opening) return;
    setOpening(true);
    let result: AcceptLinkResult = { ok: false, reason: "expired" };
    try {
      const form = new FormData();
      form.set("access_token", pendingTokens.accessToken);
      form.set("refresh_token", pendingTokens.refreshToken);
      result = await acceptLinkTokens(form);
    } catch {
      // Could not reach the server: treated like a link that did not work.
    }
    setPendingTokens(null);
    setOpening(false);
    settleLink(result);
  }

  const longEnough = password.length >= 8;
  const mismatch = confirm.length > 0 && password !== confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!longEnough || password !== confirm || saving) return;
    setFailure(null);
    setSaving(true);
    let result: SavePasswordResult;
    try {
      const form = new FormData();
      form.set("password", password);
      form.set("confirm", confirm);
      result = await savePassword(form);
    } catch {
      result = { ok: false, error: "failed" };
    }
    setSaving(false);
    if (result.ok) setDestination(result.destination);
    else setFailure(result.error);
  }

  // Which view to show. The form, once shown, only goes away because of
  // something the person did or because the page was left open too long (the
  // server stops saying "ready", for example when the language is changed).
  const deactivated = failure === "deactivated" || linkState === "deactivated";
  const timedOut = failure === "timedOut" || (wasReady && linkState === "clear" && !ready);
  const view: "done" | "lost" | "confirm" | "checking" | "form" = destination
    ? "done"
    : deactivated || timedOut || failure === "link" || linkState === "expired" || linkState === "none"
      ? "lost"
      : linkState === "confirm"
        ? "confirm"
        : linkState === "checking" || !ready
        ? "checking"
        : "form";

  // When the view changes after a submit, move focus to the new view, so
  // keyboard and screen-reader users are not left on a button that is gone.
  const viewRef = useRef<HTMLDivElement>(null);
  const lastView = useRef(view);
  useEffect(() => {
    if (lastView.current === "form" && view !== "form") viewRef.current?.focus();
    lastView.current = view;
  }, [view]);

  if (view === "done") {
    return (
      <div ref={viewRef} tabIndex={-1} role="status" className="text-center py-2 focus:outline-none">
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
        <Button size="lg" block className="mt-6" onClick={() => router.push(destination!)}>
          {t.common.continue}
        </Button>
      </div>
    );
  }

  // The link is gone (used, expired, left open too long, or the account is
  // closed): explain, and let the person send themselves a new one.
  if (view === "lost") {
    const noLink = !deactivated && !timedOut && failure !== "link" && linkState === "none";
    const message = deactivated
      ? t.auth.errors.deactivated
      : timedOut
        ? t.auth.setPassword.timedOut
        : noLink
          ? t.auth.setPassword.needLink
          : t.auth.errors.expired;
    return (
      <div ref={viewRef} tabIndex={-1} className="space-y-5 focus:outline-none">
        <Callout tone={noLink ? "info" : "warning"} role={noLink ? "status" : "alert"}>
          {message}
        </Callout>
        {!deactivated && (
          <ButtonLink href="/forgot-password" size="lg" block>
            {t.auth.setPassword.newLink}
          </ButtonLink>
        )}
        <p className="text-center">
          <Link href="/login" className="inline-flex items-center min-h-11 text-sm font-semibold text-accent hover:underline">
            {t.common.backToSignIn}
          </Link>
        </p>
      </div>
    );
  }

  // A link with sign-in tokens: name the account, warn anyone already signed
  // in as somebody else, and wait for Continue.
  if (view === "confirm" && pendingTokens) {
    const otherAccount = !!signedInEmail && signedInEmail.toLowerCase() !== pendingTokens.email.toLowerCase();
    return (
      <div className="space-y-5">
        <p className="text-base text-muted">{t.auth.confirm.subtitle}</p>
        {pendingTokens.email && (
          <p className="text-sm text-muted">
            {t.auth.setPassword.account}: <span className="font-semibold text-foreground break-all">{pendingTokens.email}</span>
          </p>
        )}
        {otherAccount && (
          <Callout tone="info">
            <p>
              {t.auth.confirm.signedInAs} <span className="font-semibold break-all">{signedInEmail}</span>
            </p>
            <p className="mt-1">{t.auth.confirm.signedInWarning}</p>
          </Callout>
        )}
        <Button size="lg" block pending={opening} pendingLabel={t.auth.confirm.pending} onClick={openLink}>
          {t.common.continue}
        </Button>
      </div>
    );
  }

  // Still looking at the address bar, or waiting for the server to confirm
  // the link that was just handed over.
  if (view === "checking") {
    return (
      <LoadingRegion label={t.auth.setPassword.checking}>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </LoadingRegion>
    );
  }

  const errorText =
    failure === "same"
      ? t.auth.setPassword.same
      : failure === "weak"
        ? t.auth.setPassword.weak
        : failure === "short"
          ? t.auth.setPassword.rule
          : failure === "mismatch"
            ? t.auth.setPassword.mismatch
            : failure
              ? t.auth.setPassword.failed
              : "";

  return (
    <div className="space-y-5">
      {errorText && (
        <Callout tone="critical" role="alert">
          {errorText}
        </Callout>
      )}
      {email && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <p className="text-muted min-w-0">
            {t.auth.setPassword.account}: <span className="font-semibold text-foreground break-all">{email}</span>
          </p>
          {/* Opened someone else's link by mistake? Sign out instead of
              choosing a password for them. */}
          <form action="/logout" method="post">
            <button type="submit" className="inline-flex items-center min-h-11 font-semibold text-accent hover:underline">
              {t.auth.setPassword.notYou}
            </button>
          </form>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
        <Button type="submit" size="lg" block pending={saving} pendingLabel={t.auth.setPassword.pending} disabled={!longEnough || password !== confirm}>
          {t.auth.setPassword.save}
        </Button>
      </form>
    </div>
  );
}
