"use client";

import { useState } from "react";

/**
 * Lets a Super Admin / Admin set a user's password directly -- no email,
 * no link, takes effect immediately. Lives inside the "Edit user" panel
 * on People & Access, next to role/department.
 *
 * Server-side (api/staff/set-password) enforces who can target whom;
 * this component just surfaces whatever it's told, and shows the
 * server's error message verbatim if the target is out of bounds (e.g.
 * an Admin trying to set a Super Admin's password).
 */
export function SetPasswordButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const reset = () => {
    setOpen(false);
    setPassword("");
    setState("idle");
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setState("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }
    setState("loading");
    try {
      const res = await fetch("/api/staff/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Couldn't set the password.");
        return;
      }
      setState("done");
      setMessage(`New password set for ${userName}.`);
      setPassword("");
      window.setTimeout(reset, 3000);
    } catch {
      setState("error");
      setMessage("Couldn't reach the server.");
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-accent-dark text-xs font-semibold hover:underline"
      >
        Set password
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (min 8 chars)"
        minLength={8}
        required
        className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent w-44"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="text-accent-dark text-xs font-semibold hover:underline disabled:opacity-50"
      >
        {state === "loading" ? "Setting…" : "Save"}
      </button>
      <button type="button" onClick={reset} className="text-faint text-xs font-semibold hover:underline">
        Cancel
      </button>
      {state === "error" && <span className="text-[11px] text-critical">{message}</span>}
      {state === "done" && <span className="text-[11px] text-good">{message}</span>}
    </form>
  );
}
