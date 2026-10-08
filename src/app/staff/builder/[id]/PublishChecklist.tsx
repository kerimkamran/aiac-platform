"use client";

import { useRef, useState } from "react";
import type { PublishCheck } from "@/lib/publish-checks";

// Replaces the swipe-to-confirm slider. The checklist shows what blocks
// publishing and what is only a warning, and AI drafts need the review tick
// before the button is enabled. The database enforces the same rules again.
export function PublishChecklist({
  title,
  checks,
  aiDraft,
  action,
}: {
  title: string;
  checks: PublishCheck[];
  aiDraft: boolean;
  action: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reviewed, setReviewed] = useState(false);
  const blocked = checks.some((c) => c.blocking && !c.ok);
  const canPublish = !blocked && (!aiDraft || reviewed);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-2 bg-brand-deep text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-accent-dark transition-colors"
      >
        Publish…
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="publish-checklist-title"
        className="rounded-2xl border border-line bg-surface p-0 text-foreground w-[min(34rem,calc(100vw-2rem))] backdrop:bg-black/40"
      >
        <form action={action} className="p-6 space-y-5">
          <h2 id="publish-checklist-title" className="font-bold text-lg">
            Publish “{title}”?
          </h2>
          <ul className="space-y-2.5">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2.5 text-sm">
                <span
                  aria-hidden
                  className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-2xs font-bold ${
                    c.ok ? "bg-emerald-600 text-white" : c.blocking ? "bg-critical text-white" : "bg-amber-500 text-white"
                  }`}
                >
                  {c.ok ? "✓" : c.blocking ? "!" : "·"}
                </span>
                <span>
                  {c.label}
                  {!c.ok && <span className="block text-2xs text-muted">{c.blocking ? "Blocks publishing." : "Warning only."}</span>}
                </span>
              </li>
            ))}
          </ul>

          {aiDraft && (
            <label className="flex items-start gap-2.5 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                name="reviewed"
                required
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[color:var(--brand)]"
              />
              I reviewed every question, including the answer key.
            </label>
          )}

          <p className="text-xs text-muted">
            Once published, the assessment can be assigned to candidates. Its questions are locked after the first candidate starts.
          </p>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => dialogRef.current?.close()} className="text-sm font-semibold border border-line rounded-xl px-4 py-2 hover:border-accent">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canPublish}
              className="text-sm font-semibold bg-brand-deep text-white rounded-xl px-5 py-2 hover:bg-accent-dark disabled:opacity-50"
            >
              Publish
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
