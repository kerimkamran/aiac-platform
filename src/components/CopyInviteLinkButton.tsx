"use client";

import { useState } from "react";

/**
 * Fallback for when Supabase's shared mailer is rate-limited or a corporate
 * spam filter eats the invite email: fetches a one-time "set your password"
 * link directly (via the Auth Admin API, server-side) and copies it to the
 * clipboard so staff can paste it into Slack/Teams/a direct email themselves.
 *
 * Clipboard notes: Safari only allows a clipboard write that is started by the
 * click itself, so the request is handed to ClipboardItem as a promise rather
 * than awaited first. If every copy method is blocked, the link is shown in a
 * selectable box so it can still be copied by hand.
 */
type State = "idle" | "loading" | "copied" | "manual" | "error";

async function fetchInviteLink(email: string): Promise<string> {
  const res = await fetch("/api/staff/invite-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.link) {
    throw new Error(data.error || "Couldn't generate a link.");
  }
  return data.link as string;
}

function copyWithExecCommand(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
}

export function CopyInviteLinkButton({ email, className = "" }: { email: string; className?: string }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");

  const reset = (ms: number) => window.setTimeout(() => setState("idle"), ms);

  const showError = (err: unknown) => {
    setMessage(err instanceof Error && err.message ? err.message : "Couldn't reach the server.");
    setState("error");
    reset(5000);
  };

  // Last-resort copy once we have the link: legacy execCommand, then manual box.
  const finishWithLink = (fetched: string) => {
    setLink(fetched);
    if (copyWithExecCommand(fetched)) {
      setState("copied");
      reset(2000);
    } else {
      setState("manual");
    }
  };

  const handleClick = () => {
    setState("loading");
    setLink("");
    setMessage("");

    // Start the request now, synchronously inside the click, so the clipboard
    // write below can also start inside the click (Safari requires this).
    const linkPromise = fetchInviteLink(email);

    if (navigator.clipboard && typeof window.ClipboardItem !== "undefined") {
      const textBlob = linkPromise.then((l) => {
        setLink(l);
        return new Blob([l], { type: "text/plain" });
      });
      navigator.clipboard
        .write([new ClipboardItem({ "text/plain": textBlob })])
        .then(() => {
          setState("copied");
          reset(2000);
        })
        .catch(() => {
          linkPromise.then(finishWithLink, showError);
        });
      return;
    }

    linkPromise.then(
      (l) => {
        setLink(l);
        if (navigator.clipboard) {
          navigator.clipboard
            .writeText(l)
            .then(() => {
              setState("copied");
              reset(2000);
            })
            .catch(() => finishWithLink(l));
        } else {
          finishWithLink(l);
        }
      },
      showError
    );
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
        <span className="absolute z-50 top-full right-0 mt-1 w-56 bg-surface border border-line rounded-lg shadow-lg px-3 py-2 text-2xs text-critical">
          {message}
        </span>
      )}

      {state === "manual" && (
        <span className="absolute z-50 top-full right-0 mt-1 w-72 bg-surface border border-line rounded-lg shadow-lg p-3 space-y-2">
          <span className="block text-2xs text-muted">Your browser blocked automatic copying. Select the link and copy it:</span>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Invite link"
            className="w-full bg-canvas border border-line rounded-md px-2 py-1 text-2xs"
          />
          <button type="button" onClick={() => setState("idle")} className="text-2xs font-semibold text-accent-dark hover:underline">
            Close
          </button>
        </span>
      )}
    </span>
  );
}
