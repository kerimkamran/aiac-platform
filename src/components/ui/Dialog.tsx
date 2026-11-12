"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";

// Dialog and Sheet (Clear Horizon plan, section 16), built on the native
// <dialog> element: the browser traps focus, closes on Esc and marks the rest
// of the page inert. Radius 16px; the one place a large shadow is allowed.
// A Sheet is the same dialog docked to the bottom (mobile) or the right edge.
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel = "Close",
  variant = "dialog",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  variant?: "dialog" | "sheet";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const sheet = variant === "sheet";
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop (the dialog element itself) closes it.
        if (e.target === ref.current) onClose();
      }}
      className={`vx-dialog ${sheet ? "vx-sheet" : ""} bg-surface text-foreground p-0 border border-line shadow-lg ${
        sheet ? "rounded-t-dialog sm:rounded-dialog" : "rounded-dialog"
      } w-[calc(100%-2rem)] max-w-lg`}
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        <h2 className="text-xl font-semibold text-foreground pt-2">{title}</h2>
        <IconButton icon="x" label={closeLabel} onClick={onClose} className="-mr-2" />
      </div>
      <div className="px-6 py-4">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-3 px-6 pb-5">{footer}</div>}
    </dialog>
  );
}

export function Sheet(props: Omit<React.ComponentProps<typeof Dialog>, "variant">) {
  return <Dialog {...props} variant="sheet" />;
}
