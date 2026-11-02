import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

// Opt-in slim left rail for deep pages (Assessment Builder, candidate detail)
// that have their own sub-sections. It sits below the top bar, not instead of
// it: primary navigation stays in the app shell everywhere, and only pages
// with genuine sub-navigation get a persistent rail for it.
export type SidebarLink = { id: string; label: string; icon?: string; href?: string };

export function SidebarLayout({
  title,
  backHref,
  backLabel,
  sections,
  activeId,
  onSelect,
  children,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  sections: SidebarLink[];
  activeId?: string;
  onSelect?: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      {/* `dvh` tracks the visible viewport as mobile browser chrome shows and hides. */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-line-soft min-h-[calc(100dvh-56px)] px-4 py-6 no-print">
        {backHref && (
          <Link href={backHref} className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-5 px-1">
            <Icon name="arrowLeft" className="w-4 h-4" />
            {backLabel || "Back"}
          </Link>
        )}
        <p className="px-1 mb-2 text-sm font-semibold text-foreground truncate">{title}</p>
        <nav className="space-y-0.5">
          {sections.map((s) => {
            const active = s.id === activeId;
            const content = (
              <span
                className={`flex items-center gap-2.5 px-3 min-h-10 rounded-md text-sm w-full text-left ${
                  active ? "font-semibold text-foreground bg-surface-sunken" : "font-medium text-muted hover:text-foreground hover:bg-surface-sunken"
                }`}
              >
                {s.icon && <Icon name={s.icon} className="w-4 h-4 shrink-0" />}
                {s.label}
              </span>
            );
            return s.href ? (
              <Link key={s.id} href={s.href} aria-current={active ? "page" : undefined}>
                {content}
              </Link>
            ) : (
              <button key={s.id} onClick={() => onSelect?.(s.id)} className="w-full" aria-current={active ? "page" : undefined}>
                {content}
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
