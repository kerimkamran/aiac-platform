"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Avatar, Icon, LogoMark } from "@/components/ui";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";

export type NavLink = { href: string; label: string; icon: string; exact?: boolean };

export function NavShell({
  role,
  name,
  links,
  children,
}: {
  role: string;
  name: string;
  links: NavLink[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (l: NavLink) => (l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + "/"));

  const sidebar = (
    <div className="h-full flex flex-col bg-background border-r border-line">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-line">
        <Link href="/" className="flex items-center gap-2.5 min-w-0" onClick={() => setOpen(false)}>
          <LogoMark className="w-8 h-8 shrink-0 rounded-[10px]" />
          <span className="leading-none min-w-0">
            <span className="block text-[13px] font-bold text-foreground truncate">AI Assessment Center</span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-dark mt-1">by Azerconnect Group</span>
          </span>
        </Link>
      </div>

      <CommandPalette links={links} />
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">Workspace</p>
        {links.map((l) => {
          const active = isActive(l);
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors ${
                active ? "bg-surface text-brand shadow-[0_1px_2px_rgba(22,24,28,0.06)] ring-1 ring-line" : "text-muted hover:bg-line/50 hover:text-foreground"
              }`}
            >
              <Icon name={l.icon} className={`w-[18px] h-[18px] ${active ? "text-accent-dark" : "text-faint group-hover:text-muted"}`} />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-line space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar name={name} className="w-9 h-9 text-xs" />
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-foreground truncate">{name}</p>
            <p className="text-[10px] uppercase tracking-wider text-accent-dark font-semibold">{role.replace(/_/g, " ")}</p>
          </div>
        </div>
        <ThemeToggle className="w-full px-3 py-2 rounded-xl text-[13px] font-medium text-muted hover:bg-line/50 hover:text-foreground transition-colors" />
        <form action="/logout" method="post">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-muted hover:bg-line/50 hover:text-foreground transition-colors">
            <Icon name="logout" className="w-[18px] h-[18px] text-faint" />
            Log out
          </button>
        </form>
        <a
          href="https://www.linkedin.com/in/thekmrnkrml/"
          target="_blank"
          rel="noreferrer"
          className="block text-center text-[10.5px] text-faint/70 hover:text-muted transition-colors mt-3"
        >
          Developed by Kamran Karimli
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 sticky top-0 h-screen no-print">{sidebar}</aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-background/95 backdrop-blur border-b border-line px-4 py-3 no-print">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark className="w-7 h-7" />
          <span className="text-sm font-bold text-foreground">AIAC</span>
        </Link>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2 -mr-2 text-foreground">
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
  );
}
