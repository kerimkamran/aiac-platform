"use client";

import { useState } from "react";

/**
 * Fallback for when Supabase's shared mailer is rate-limited or a corporate
 * spam filter eats the invite email: fetches a one-time "set your password"
 * link directly (via the Auth Admin API, server-side) and copies it to the
 * clipboard so staff can paste it into Slack/Teams/a direct email themselves.
 */
export function CopyInviteLinkButton({ email, className = "" }: { email: string; className?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleClick = async () => {
    setState("loading");
    try {
      const res = await fetch("/api/staff/invite-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.link) {
        setMessage(data.error || "Couldn't generate a link.");
        setState("error");
        window.setTimeout(() => setState("idle"), 4000);
        return;
      }
      await navigator.clipboard.writeText(data.link);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setMessage("Couldn't reach the server.");
      setState("error");
      window.setTimeout(() => setState("idle"), 4000);
    }
  };

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "loading"}
        className={className || "text-accent-dark text-xs font-semibold hover:underline disabled:opacity-50"}
      >
        {state === "copied" ? "Link copied!" : state === "loading" ? "Generating…" : "Copy invite link"}
      </button>
      {state === "error" && (
        <span className="absolute z-50 top-full right-0 mt-1 w-56 bg-surface border border-line rounded-lg shadow-lg px-3 py-2 text-[11px] text-critical">
          {message}
        </span>
      )}
    </span>
  );
}
