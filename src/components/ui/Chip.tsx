import type { ReactNode } from "react";

// Pill chip for selectable tags (plan v2, section 4.3).
export function Chip({ selected = false, children, onClick }: { selected?: boolean; children: ReactNode; onClick?: () => void }) {
  const base = "inline-flex items-center gap-1.5 min-h-8 px-3 rounded-full text-sm font-medium ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus";
  const cls = selected ? "bg-primary-container text-on-primary-container ring-accent" : "bg-surface text-foreground ring-line-control hover:bg-line-soft";
  return onClick ? (
    <button type="button" aria-pressed={selected} onClick={onClick} className={`${base} ${cls}`}>
      {children}
    </button>
  ) : (
    <span className={`${base} ${cls}`}>{children}</span>
  );
}
