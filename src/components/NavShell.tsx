"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Avatar, Icon, LogoMark } from "@/components/ui";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ToastProvider } from "@/components/Toaster";

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

  const sidebar = (
    <div className="h-full flex flex-col bg-brand-deep text-white">
      <div className="px-5 py-6 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 min-w-0" onClick={() => setOpen(false)}>
          <LogoMark className="w-9 h-9 shrink-0 rounded-[10px] ring-2 ring-white/15" />
          <span className="leading-none min-w-0">
            <span className="block text-[14px] font-bold text-white truncate [font-family:var(--font-display)]">AI Assessment Center</span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.22em] text-accent mt-1.5">by Azerconnect Group</span>
          </span>
        </Link>
      </div>
      <div className="mx-5 h-px bg-white/10" />

      <CommandPalette links={links} actions={actions} />
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Workspace</p>
        {links.map((l) => {
          const active = isActive(l);
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] font-semibold transition-colors ${
                active ? "bg-accent text-white" : "text-white/65 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon name={l.icon} className={`w-[18px] h-[18px] ${active ? "text-white" : "text-white/45 group-hover:text-white/80"}`} />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 space-y-2">
        <div className="mx-2 mb-2 h-px bg-white/10" />
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar name={name} className="w-9 h-9 text-xs ring-2 ring-white/20" />
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-white truncate">{name}</p>
            <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">{role.replace(/_/g, " ")}</p>
          </div>
        </div>
        <ThemeToggle className="w-full px-3 py-2 rounded-lg text-[13px] font-medium text-white/65 hover:bg-white/10 hover:text-white transition-colors" />
        <form action="/logout" method="post">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-white/65 hover:bg-white/10 hover:text-white transition-colors">
            <Icon name="logout" className="w-[18px] h-[18px] text-white/45" />
            Log out
          </button>
        </form>
        <a
          href="https://www.linkedin.com/in/thekmrnkrml/"
          target="_blank"
          rel="noreferrer"
          className="block text-center text-[10.5px] text-white/30 hover:text-white/60 transition-colors mt-3"
        >
          Developed by Kamran Karimli
        </a>
      </div>
    </div>
  );

  return (
    <ToastProvider>
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 sticky top-0 h-screen no-print">{sidebar}</aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-brand-deep px-4 py-3 no-print">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark className="w-7 h-7" />
          <span className="text-sm font-bold text-white">AIAC</span>
        </Link>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2 -mr-2 text-white">
          <Icon name="menu" className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile slide-over */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 no-print">
          <div className="absolute inset-0 bg-black/40 anim-fade-in" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl anim-fade-in">
            {sidebar}
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-4 right-3 text-muted p-2">
              <Icon name="x" className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-12 lg:pt-0">{children}</main>
    </div>
    </ToastProvider>
  );
}
