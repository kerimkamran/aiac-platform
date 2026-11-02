import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

// Surfaces (Clear Horizon plan, section 16). Hairlines carry structure; a
// card exists only for things you act on. The horizon rule marks the single
// most important card on a screen.

export function Card({
  className = "",
  id,
  children,
  interactive = false,
}: {
  className?: string;
  id?: string;
  children: ReactNode;
  interactive?: boolean;
}) {
  return (
    <div
      id={id}
      className={`bg-surface border border-line rounded-xl print-card ${interactive ? "lift-on-hover hover:border-line-strong cursor-pointer" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

// The primary card on a home: a card with the 2px horizon rule along its top.
export function PrimaryCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`relative bg-surface border border-line rounded-xl shadow-sm overflow-hidden print-card ${className}`}>
      <div aria-hidden className="horizon-rule absolute inset-x-0 top-0" />
      {children}
    </div>
  );
}

// The deep navy brand block. At most one per screen.
export function Panel({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`bg-panel text-on-panel rounded-xl ${className}`}>{children}</div>;
}

// A list row where the whole row is the target (Clear Horizon plan, section
// 16). Rows are separated by hairlines, not boxes.
export function ListRow({
  href,
  children,
  trailing,
  className = "",
}: {
  href?: string;
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
      {href && <Icon name="chevronRight" className="w-4 h-4 text-muted shrink-0" />}
    </>
  );
  const base = `flex items-center gap-4 min-h-14 px-4 py-3 border-b border-line-soft last:border-b-0 ${className}`;
  return href ? (
    <Link href={href} className={`${base} press hover:bg-surface-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus`}>
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}

// A numbered figure frame for the public pages ("Fig. 01"): a mono label, a
// hairline frame and an optional caption. The contents are live components.
export function Fig({ n, caption, children, className = "" }: { n: number; caption?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <figure className={className}>
      <figcaption className="text-mono-label text-muted mb-3">Fig. {String(n).padStart(2, "0")}</figcaption>
      <div className="rounded-figure border border-line bg-surface p-4 sm:p-6 shadow-sm">{children}</div>
      {caption && <p className="text-sm text-muted mt-3 measure">{caption}</p>}
    </figure>
  );
}
