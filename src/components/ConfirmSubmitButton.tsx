"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { buttonClass } from "@/components/ui/Button";

export type ConfirmTone = "critical" | "brand" | "accent";

function inferTone(className: string): ConfirmTone {
  if (className.includes("critical")) return "critical";
  if (className.includes("accent")) return "accent";
  return "brand";
}

/**
 * A button that asks once before it submits its form: a normal button opens a
 * small confirmation that names the consequence, with a plain "Confirm"
 * button (the slide-to-confirm handle is gone, redesign plan B6). Escape or a
 * click outside closes it and focus returns to the trigger.
 *
 * Pass `compact` for tight spaces (table rows, inline links): the trigger keeps
 * the caller's own look. Without it, the trigger is a regular button.
 */
export function ConfirmSubmitButton({
  confirmMessage,
  className = "",
  icon,
  children,
  compact = false,
  tone: toneProp,
  disabled = false,
  label,
}: {
  confirmMessage: string;
  className?: string;
  icon?: string;
  children?: React.ReactNode;
  compact?: boolean;
  tone?: ConfirmTone;
  disabled?: boolean;
  // An icon-only trigger needs an accessible name; falls back to confirmMessage.
  label?: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const tone = toneProp ?? inferTone(className);

  const submitForm = () => {
    setOpen(false);
    anchorRef.current?.closest("form")?.requestSubmit();
  };

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const fullWidth = className.includes("w-full");
  const triggerClass = compact ? className : buttonClass({ size: "md", variant: tone === "critical" ? "danger" : "primary", block: fullWidth });

  return (
    <span ref={anchorRef} className={`relative ${compact ? "inline-block" : fullWidth ? "block w-full" : "inline-block"}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        aria-label={children ? undefined : label ?? confirmMessage}
      >
        {icon && <Icon name={icon} className="w-3.5 h-3.5" />}
        {children}
      </button>
      {open && (
        <div
          ref={popoverRef}
          role="alertdialog"
          aria-label={label ?? confirmMessage}
          className="absolute z-50 top-full right-0 mt-2 w-64 bg-surface border border-line rounded-card shadow-md p-4 anim-fade-in text-left"
        >
          <p className="text-sm text-foreground leading-snug mb-3">{confirmMessage}</p>
          <div className="flex gap-2">
            <button
              type="button"
              autoFocus
              onClick={submitForm}
              className={buttonClass({ size: "sm", variant: tone === "critical" ? "danger" : "primary" })}
            >
              Confirm
            </button>
            <button type="button" onClick={() => setOpen(false)} className={buttonClass({ size: "sm", variant: "secondary" })}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
