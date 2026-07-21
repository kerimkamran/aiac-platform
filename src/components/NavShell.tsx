"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Avatar, Icon, LogoMark } from "@/components/ui";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ToastProvider } from "@/components/Toaster";
import { ScoutLauncher } from "@/components/ScoutLauncher";
import type { ScoutRole } from "@/lib/scout-intents";

// Maps the DB's raw role string to Scout's coarser role categories.
function toScoutRole(role: string): ScoutRole {
  if (role === "candidate") return "candidate";
  if (role === "decision_maker") return "decision_maker";
  if (role === "system_admin") return "admin";
  return "staff";
}

export type NavLink = { href: string; label: string; icon: string; exact?: boolean };

export function NavShell({
  role,
  name,
  links,
  actions,
  children,
}: {
  role: string;
  name: string;
  links: NavLink[];
  actions?: NavLink[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (l: NavLink) => (l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + "/"));

  const topLinks = (
    <>
      {links.map((l) => {
        const active = isActive(l);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            className={`text-[13px] pb-[3px] border-b-2 transition-colors ${
              active
                ? "font-semibold text-foreground border-foreground"
                : "font-medium text-muted border-transparent hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-background">
        {/* Top nav -- primary navigation for every role. Deep pages that need
            their own sub-sections (Builder, People & Access, candidate detail)
            layer a SidebarLayout underneath this, they don't get a second
            top-level nav system. */}
        <header className="sticky top-0 z-40 bg-surface border-b border-line no-print">
          <div className="flex items-center justify-between h-14 px-5 lg:px-8">
            <div className="flex items-center gap-8 min-w-0">
              <Link href="/" className="flex items-center gap-2 shrink-0">
                <LogoMark className="w-6 h-6 rounded-[6px]" />
                <span className="text-[14px] font-semibold text-foreground tracking-tight hidden sm:inline">Vantage</span>
              </Link>
              <nav className="hidden lg:flex items-center gap-6 min-w-0">{topLinks}</nav>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden lg:block">
                <CommandPalette links={links} actions={actions} />
              </div>
              <ThemeToggle className="p-1.5 rounded-md text-faint hover:text-muted hover:bg-line-soft transition-colors hidden sm:inline-flex" />
              <div className="hidden lg:flex items-center gap-2.5 pl-3 border-l border-line">
                <Avatar name={name} className="w-7 h-7 text-[10.5px]" />
                <div className="leading-tight">
                  <p className="text-[12.5px] font-semibold text-foreground">{name.split(" ")[0]}</p>
                  <p className="text-[10px] text-faint capitalize">{role.replace(/_/g, " ")}</p>
                </div>
              </div>
              <form action="/logout" method="post" className="hidden lg:block">
                <button aria-label="Log out" className="p-1.5 rounded-md text-faint hover:text-muted hover:bg-line-soft transition-colors">
                  <Icon name="logout" className="w-4 h-4" />
                </button>
              </form>
              <button onClick={() => setOpen(true)} aria-label="Open menu" className="lg:hidden p-2 -mr-2 text-foreground">
                <Icon name="menu" className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile slide-over -- same links, stacked, for narrow viewports */}
        {open && (
          <div className="lg:hidden fixed inset-0 z-50 no-print">
            <div className="absolute inset-0 bg-black/40 anim-fade-in" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 right-0 w-72 bg-surface border-l border-line anim-fade-up flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <span className="text-[13px] font-semibold text-foreground">Menu</span>
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-muted p-1">
                  <Icon name="x" className="w-4.5 h-4.5" />
                </button>
              </div>
              <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                {links.map((l) => {
                  const active = isActive(l);
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-[13.5px] ${
                        active ? "font-semibold text-foreground bg-line-soft" : "font-medium text-muted"
                      }`}
                    >
                      <Icon name={l.icon} className="w-[17px] h-[17px] text-faint" />
                      {l.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="px-3 py-4 border-t border-line space-y-1">
                <div className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={name} className="w-8 h-8 text-[11px]" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-foreground truncate">{name}</p>
                    <p className="text-[10px] text-faint capitalize">{role.replace(/_/g, " ")}</p>
                  </div>
                </div>
                <form action="/logout" method="post">
                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium text-muted">
                    <Icon name="logout" className="w-[17px] h-[17px] text-faint" />
                    Log out
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0">{children}</main>

        <footer className="border-t border-line no-print">
          <div className="max-w-[1180px] mx-auto px-6 lg:px-10 py-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11.5px] text-faint">Vantage by Azerconnect Group</span>
            <a
              href="https://www.linkedin.com/in/thekmrnkrml/"
              target="_blank"
              rel="noreferrer"
              className="text-[11.5px] text-faint hover:text-muted transition-colors"
            >
              Developed by Kamran Karimli
            </a>
          </div>
        </footer>

        <ScoutLauncher role={toScoutRole(role)} />
      </div>
    </ToastProvider>
  );
}

/* ---------------- Sidebar sub-navigation ---------------- */
// Opt-in slim left rail for deep pages (Assessment Builder, People & Access,
// candidate detail) that have their own sub-sections. Sits below the top
// nav, not instead of it -- this is the "B" pattern from the approved
// navigation comparison: primary nav stays a top bar everywhere, and only
// pages with genuine sub-navigation get a persistent rail for it.
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
      <aside className="hidden md:flex flex-col w-[168px] shrink-0 border-r border-line min-h-[calc(100vh-56px)] px-3 py-6 no-print">
        {backHref && (
          <Link href={backHref} className="flex items-center gap-1.5 text-[12px] text-faint hover:text-muted mb-5 px-1">
            <Icon name="arrowLeft" className="w-3.5 h-3.5" />
            {backLabel || "Back"}
          </Link>
        )}
        <p className="px-1 mb-2 text-[11px] font-semibold text-foreground truncate">{title}</p>
        <nav className="space-y-0.5">
          {sections.map((s) => {
            const active = s.id === activeId;
            const content = (
              <span
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] w-full text-left ${
                  active ? "font-semibold text-foreground bg-line-soft" : "text-muted hover:text-foreground"
                }`}
              >
                {s.icon && <Icon name={s.icon} className="w-3.5 h-3.5 shrink-0" />}
                {s.label}
              </span>
            );
            return s.href ? (
              <Link key={s.id} href={s.href}>
                {content}
              </Link>
            ) : (
              <button key={s.id} onClick={() => onSelect?.(s.id)} className="w-full">
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
