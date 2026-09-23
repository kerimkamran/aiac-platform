"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { SwipeToConfirm, type SwipeTone } from "@/components/SwipeToConfirm";

function inferTone(className: string): SwipeTone {
  if (className.includes("critical")) return "critical";
  if (className.includes("accent")) return "accent";
  return "brand";
}

/**
 * Drop-in replacement for the old window.confirm()-based button: submits the
 * surrounding <form> once the user drags a handle all the way across a
 * track instead of just clicking. Same props as before (confirmMessage,
 * className, icon, children) so every existing call site keeps working —
 * pass `compact` for tight spaces (table rows, inline text links), which
 * keeps the original trigger's look and reveals the slider in a small
 * popover instead of inline.
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
  tone?: SwipeTone;
  disabled?: boolean;
  // Design-execution-plan Phase 2 / T2.2: the compact trigger below renders
  // icon + children with no other text, so a `compact` call site that passes
  // an icon but no children (e.g. an icon-only delete button) would render
  // an empty accessible name -- WCAG 4.1.2. Pass `label` there; it falls
  // back to confirmMessage so an icon-only trigger is never nameless even
  // if a future call site forgets it.
  label?: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const tone = toneProp ?? inferTone(className);

  const submitForm = () => {
    const form = anchorRef.current?.closest("form");
    form?.requestSubmit();
  };

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  if (!compact) {
    const fullWidth = className.includes("w-full");
    return (
      <span ref={anchorRef} className={fullWidth ? "block w-full" : "block"}>
        <SwipeToConfirm
          label={
            <span className="inline-flex items-center gap-1.5">
              {icon && <Icon name={icon} className="w-3.5 h-3.5" />}
              {children}
            </span>
          }
          ariaLabel={label ?? confirmMessage}
          onConfirm={submitForm}
          tone={tone}
          icon={icon || "arrowRight"}
          disabled={disabled}
          className={fullWidth ? "w-full" : "w-full max-w-[190px]"}
        />
      </span>
    );
  }

  return (
    <span ref={anchorRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={className}
        aria-expanded={open}
        disabled={disabled}
        aria-label={children ? undefined : label ?? confirmMessage}
      >
        {icon && <Icon name={icon} className="w-3.5 h-3.5" />}
        {children}
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="absolute z-50 top-full right-0 mt-2 w-56 bg-surface border border-line rounded-2xl shadow-xl p-3 anim-fade-in"
        >
          <p className="text-2xs text-muted leading-snug mb-2.5">{confirmMessage}</p>
          <SwipeToConfirm
            label={
              <span className="inline-flex items-center gap-1.5 text-xs">
                {icon && <Icon name={icon} className="w-3.5 h-3.5" />}
                {children}
              </span>
            }
            ariaLabel={label ?? confirmMessage}
            onConfirm={submitForm}
            tone={tone}
            icon={icon || "arrowRight"}
            disabled={disabled}
            height={38}
            className="w-full"
          />
        </div>
      )}
    </span>
  );
}
