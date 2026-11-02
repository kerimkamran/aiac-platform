"use client";

import { useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { FieldError, FieldLabel, type FieldSize } from "@/components/ui/Field";

// Password input with a Show / Hide toggle. Error and hint are wired to the
// input with aria-describedby, like TextField.
export function PasswordField({
  label,
  hint,
  error,
  fieldSize = "md",
  className = "",
  id,
  showLabel = "Show",
  hideLabel = "Hide",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  fieldSize?: FieldSize;
  showLabel?: string;
  hideLabel?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const [shown, setShown] = useState(false);
  const errId = `${fid}-error`;
  const hintId = `${fid}-hint`;
  return (
    <div className={className}>
      <FieldLabel htmlFor={fid}>{label}</FieldLabel>
      <div className="relative">
        <input
          {...props}
          id={fid}
          type={shown ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined}
          className={`w-full bg-surface border border-line-control rounded-md pl-3.5 pr-16 text-base text-foreground placeholder:text-muted transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus aria-[invalid=true]:border-critical disabled:opacity-50 ${fieldSize === "lg" ? "min-h-12 py-3" : "min-h-10 py-2"}`}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-pressed={shown}
          className="absolute inset-y-0 right-1 my-auto h-9 px-3 rounded-md text-sm font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
        >
          {shown ? hideLabel : showLabel}
        </button>
      </div>
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={errId}>{error}</FieldError>}
    </div>
  );
}
