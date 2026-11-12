"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Dialog";
import { CommandPalette } from "@/components/CommandPalette";
import { AppearancePanel } from "@/components/AppearanceMenu";
import { NotificationsBell } from "@/components/NotificationsBell";
import { ToastProvider } from "@/components/Toaster";
import type { CanvasChoice } from "@/lib/appearance";

// The signed-in app shell (Clear Horizon plan, section 15). One frosted 56px
// top bar for every role: the mark and wordmark link to *your* home, text
// navigation sits in the centre with an underlined active item, and search,
// notifications and the account menu sit on the right. On phones the bar shows
// the mark, the bell and a menu button; the menu opens a sheet with everything.
export type NavLink = { href: string; label: string; icon: string; exact?: boolean };

export function AppShell({
  role,
  name,
  homeHref,
  links,
  actions,
  contextLabel,
  switchLinks = [],
  showSearch = true,
  showBell = true,
  defaultCanvas = "white",
  showCredit = false,
  children,
}: {
  role: string;
  name: string;
  homeHref: string;
  links: NavLink[];
  actions?: NavLink[];
  // A small label next to the wordmark when the person can switch areas,
  // for example "Admin".
  contextLabel?: string;
  // Areas this person can switch to (Workspace, Admin, My assessments).
  switchLinks?: NavLink[];
  showSearch?: boolean;
  showBell?: boolean;
  // Role default background: cream for candidates.
  defaultCanvas?: CanvasChoice;
  // The developer credit appears in the staff and admin footer only.
  showCredit?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const roleLabel = role.replace(/_/g, " ");
  const cream = defaultCanvas === "cream";

  const isActive = (l: NavLink) => (l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + "/"));

  // A hairline appears under the frosted bar once content scrolls beneath it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the account menu on outside click and Escape, and on navigation.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMenuOpen(false);
    setSheetOpen(false);
  }, [pathname]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const accountLinks = (
    <>
      {switchLinks.map((l) => (
        <Link key={l.href} href={l.href} className="flex items-center gap-3 px-3 min-h-11 rounded-md text-sm font-medium text-foreground hover:bg-surface-sunken">
          <Icon name={l.icon} className="w-5 h-5 text-muted" />
          {l.label}
        </Link>
      ))}
      <Link href="/privacy" className="flex items-center gap-3 px-3 min-h-11 rounded-md text-sm font-medium text-foreground hover:bg-surface-sunken">
        <Icon name="shield" className="w-5 h-5 text-muted" />
        Privacy
      </Link>
      <Link href="/help/invitation" className="flex items-center gap-3 px-3 min-h-11 rounded-md text-sm font-medium text-foreground hover:bg-surface-sunken">
        <Icon name="helpCircle" className="w-5 h-5 text-muted" />
        Help
      </Link>
    </>
  );

  return (
    <ToastProvider>
      <div className={`min-h-screen flex flex-col bg-background ${cream ? "canvas-role-cream" : ""}`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-brand focus:text-on-primary focus:px-4 focus:py-2.5 focus:rounded-md focus:text-sm focus:font-semibold"
        >
          Skip to main content
        </a>

        <header data-scrolled={scrolled} className="glass sticky top-0 z-40 no-print">
          <div className="container-page flex items-center justify-between h-14">
            <div className="flex items-center gap-8 min-w-0">
              <Link href={homeHref} className="flex items-center gap-3 shrink-0 rounded-md" aria-label="Vantage, go to my home">
                <Logo compact />
                {contextLabel && (
                  <span className="hidden sm:inline text-sm font-medium text-muted pl-3 border-l border-line">{contextLabel}</span>
                )}
              </Link>
              {links.length > 0 && (
                <nav aria-label="Main" className="hidden lg:flex items-center gap-6 min-w-0">
                  {links.map((l) => {
                    const active = isActive(l);
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        aria-current={active ? "page" : undefined}
                        className={`text-sm py-[17px] border-b-2 whitespace-nowrap transition-colors ${
                          active ? "font-semibold text-foreground border-foreground" : "font-medium text-muted border-transparent hover:text-foreground"
                        }`}
                      >
                        {l.label}
                      </Link>
                    );
                  })}
                </nav>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {showSearch && links.length > 0 && <CommandPalette links={links} actions={actions} />}
              {showBell && <NotificationsBell />}

              <div ref={menuRef} className="relative hidden lg:block ml-2">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                  className="press flex items-center gap-2 h-11 pl-1 pr-2 rounded-md hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <Avatar name={name} className="w-8 h-8 text-xs" />
                  <Icon name="chevronDown" className="w-4 h-4 text-muted" />
                </button>
                {menuOpen && (
                  <div role="menu" className="anim-menu absolute right-0 top-12 z-50 w-80 rounded-xl bg-surface text-foreground border border-line shadow-md">
                    <div className="px-4 py-3 border-b border-line">
                      <p className="text-base font-semibold text-foreground truncate">{name}</p>
                      <p className="text-sm text-muted capitalize">{roleLabel}</p>
                    </div>
                    {switchLinks.length > 0 && <div className="p-2 border-b border-line">{accountLinks}</div>}
                    <div className="p-4 border-b border-line">
                      <p className="text-xs font-semibold text-muted mb-3">Appearance</p>
                      <AppearancePanel defaultCanvas={defaultCanvas} />
                    </div>
                    <div className="p-2">
                      {switchLinks.length === 0 && accountLinks}
                      <form action="/logout" method="post">
                        <button className="w-full flex items-center gap-3 px-3 min-h-11 rounded-md text-sm font-medium text-foreground hover:bg-surface-sunken">
                          <Icon name="logout" className="w-5 h-5 text-muted" />
                          Sign out
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>

              <IconButton icon="menu" label="Open menu" onClick={() => setSheetOpen(true)} className="lg:hidden -mr-2" aria-haspopup="dialog" />
            </div>
          </div>
        </header>

        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Menu">
          <div className="-mx-2 space-y-0.5">
            {links.map((l) => {
              const active = isActive(l);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 px-3 min-h-11 rounded-md text-base ${active ? "font-semibold text-foreground bg-surface-sunken" : "font-medium text-foreground"}`}
                >
                  <Icon name={l.icon} className="w-5 h-5 text-muted" />
                  {l.label}
                </Link>
              );
            })}
          </div>
          <div className="-mx-2 mt-3 pt-3 border-t border-line space-y-0.5">{accountLinks}</div>
          <div className="mt-3 pt-4 border-t border-line">
            <div className="flex items-center gap-3 mb-4">
              <Avatar name={name} className="w-10 h-10 text-sm" />
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground truncate">{name}</p>
                <p className="text-sm text-muted capitalize">{roleLabel}</p>
              </div>
            </div>
            <AppearancePanel defaultCanvas={defaultCanvas} />
            <form action="/logout" method="post" className="mt-4">
              <button className="w-full flex items-center gap-3 px-3 min-h-11 rounded-md text-base font-medium text-foreground ring-1 ring-inset ring-line-control">
                <Icon name="logout" className="w-5 h-5 text-muted" />
                Sign out
              </button>
            </form>
          </div>
        </Sheet>

        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 focus:outline-none">
          {children}
        </main>

        <footer className="border-t border-line-soft no-print">
          <div className="container-page py-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm text-muted">
            <span>Vantage by Azerconnect Group</span>
            <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link href="/about" className="hover:text-foreground">
                About
              </Link>
              {showCredit && (
                <a href="https://www.linkedin.com/in/thekmrnkrml/" target="_blank" rel="noreferrer" className="hover:text-foreground">
                  Developed by Kamran Karimli
                </a>
              )}
            </span>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}
