import type { ReactNode } from "react";

// Chip for selectable tags (Clear Horizon plan, section 16).
export function Chip({ selected = false, children, onClick }: { selected?: boolean; children: ReactNode; onClick?: () => void }) {
  const base =
    "press inline-flex items-center gap-1.5 min-h-8 px-3 rounded-md text-sm font-medium ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";
  const cls = selected
    ? "bg-primary-container text-on-primary-container ring-accent"
    : "bg-surface text-foreground ring-line-control hover:bg-surface-sunken";
  return onClick ? (
    <button type="button" aria-pressed={selected} onClick={onClick} className={`${base} ${cls}`}>
      {children}
    </button>
  ) : (
    <span className={`${base} ${cls}`}>{children}</span>
  );
}
