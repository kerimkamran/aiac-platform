"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const isActive = (l: NavLink) => (l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + "/"));

  // Design-execution-plan Phase 2 / T2.4: the mobile drawer is a real modal
  // dialog now, not a div that happens to look like one -- role, focus
  // moved into it on open, Tab trapped inside it, Escape closes it, and
  // focus restored to the button that opened it on close.
  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    const menuButton = menuButtonRef.current;
    const focusable = drawer?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      menuButton?.focus();
    };
  }, [open]);

  const topLinks = (
    <>
      {links.map((l) => {
        const active = isActive(l);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            className={`text-xs pb-[3px] border-b-2 transition-colors ${
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
        {/* Design-execution-plan Phase 2 / T2.3: no bypass mechanism existed
            anywhere in the app -- WCAG 2.4.1. Visually hidden until it
            receives focus (first Tab stop on every page), then jumps past
            the nav straight to the main landmark below. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-brand-deep focus:text-white focus:px-4 focus:py-2.5 focus:rounded-xl focus:text-sm focus:font-semibold"
        >
          Skip to main content
        </a>
        {/* Top nav -- primary navigation for every role. Deep pages that need
            their own sub-sections (Builder, People & Access, candidate detail)
            layer a SidebarLayout underneath this, they don't get a second
            top-level nav system. */}
        <header className="sticky top-0 z-40 bg-surface border-b border-line no-print">
          <div className="flex items-center justify-between h-14 px-5 lg:px-8">
            <div className="flex items-center gap-8 min-w-0">
              <Link href="/" className="flex items-center gap-2 shrink-0">
                <LogoMark className="w-6 h-6 rounded-[6px]" />
                <span className="text-sm font-semibold text-foreground tracking-tight hidden sm:inline">Vantage</span>
              </Link>
              <nav className="hidden lg:flex items-center gap-6 min-w-0">{topLinks}</nav>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden lg:block">
                <CommandPalette links={links} actions={actions} />
              </div>
              <ThemeToggle className="p-1.5 rounded-md text-muted hover:text-muted hover:bg-line-soft transition-colors hidden sm:inline-flex" />
              <div className="hidden lg:flex items-center gap-2.5 pl-3 border-l border-line">
                <Avatar name={name} className="w-7 h-7 text-2xs" />
                <div className="leading-tight">
                  <p className="text-xs font-semibold text-foreground">{name.split(" ")[0]}</p>
                  <p className="text-2xs text-muted capitalize">{role.replace(/_/g, " ")}</p>
                </div>
              </div>
              <form action="/logout" method="post" className="hidden lg:block">
                <button aria-label="Log out" className="p-1.5 rounded-md text-muted hover:text-muted hover:bg-line-soft transition-colors">
                  <Icon name="logout" className="w-4 h-4" />
                </button>
              </form>
              <button
                ref={menuButtonRef}
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                aria-haspopup="dialog"
                aria-expanded={open}
                className="lg:hidden p-2 -mr-2 text-foreground"
              >
                <Icon name="menu" className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile slide-over -- same links, stacked, for narrow viewports */}
        {open && (
          <div className="lg:hidden fixed inset-0 z-50 no-print">
            <div className="absolute inset-0 bg-black/40 anim-fade-in" onClick={() => setOpen(false)} />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-y-0 right-0 w-72 bg-surface border-l border-line anim-fade-up flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <span className="text-xs font-semibold text-foreground">Menu</span>
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
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
                        active ? "font-semibold text-foreground bg-line-soft" : "font-medium text-muted"
                      }`}
                    >
                      <Icon name={l.icon} className="w-[17px] h-[17px] text-muted" />
                      {l.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="px-3 py-4 border-t border-line space-y-1">
                <div className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={name} className="w-8 h-8 text-2xs" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{name}</p>
                    <p className="text-2xs text-muted capitalize">{role.replace(/_/g, " ")}</p>
                  </div>
                </div>
                {/* Design-execution-plan Phase 6 / T6.1: the theme toggle was
                    `hidden sm:inline-flex` in the top bar and had no presence
                    in this drawer at all, so it was simply unreachable below
                    that breakpoint -- the one place a phone user could always
                    get to. */}
                <ThemeToggle className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium text-muted" />
                <form action="/logout" method="post">
                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium text-muted">
                    <Icon name="logout" className="w-[17px] h-[17px] text-muted" />
                    Log out
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 focus:outline-none">
          {children}
        </main>

        <footer className="border-t border-line no-print">
          <div className="max-w-[1180px] mx-auto px-6 lg:px-10 py-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-2xs text-muted">Vantage by Azerconnect Group</span>
            <a
              href="https://www.linkedin.com/in/thekmrnkrml/"
              target="_blank"
              rel="noreferrer"
              className="text-2xs text-muted hover:text-muted transition-colors"
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
      {/* Design-execution-plan Phase 6 / T6.2: `100vh` is the *largest*
          possible viewport on mobile browsers -- it doesn't shrink when the
          address bar/toolbar chrome is on screen, so this rail's computed
          min-height used to run past the bottom of the visible area. `dvh`
          tracks the actual visible viewport as browser chrome shows/hides.
          This aside is desktop-only (`md:flex`) but keeping the unit correct
          costs nothing and matches how the rest of the app should measure
          viewport height going forward. */}
      <aside className="hidden md:flex flex-col w-[168px] shrink-0 border-r border-line min-h-[calc(100dvh-56px)] px-3 py-6 no-print">
        {backHref && (
          <Link href={backHref} className="flex items-center gap-1.5 text-2xs text-muted hover:text-muted mb-5 px-1">
            <Icon name="arrowLeft" className="w-3.5 h-3.5" />
            {backLabel || "Back"}
          </Link>
        )}
        <p className="px-1 mb-2 text-2xs font-semibold text-foreground truncate">{title}</p>
        <nav className="space-y-0.5">
          {sections.map((s) => {
            const active = s.id === activeId;
            const content = (
              <span
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs w-full text-left ${
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
