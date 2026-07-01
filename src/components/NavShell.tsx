"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavShell({
  role,
  name,
  links,
  children,
}: {
  role: string;
  name: string;
  links: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 bg-brand text-white flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <Link href="/" className="font-semibold text-sm leading-tight block">
            AI Assessment Center <span className="text-accent">by AG</span>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === l.href || pathname.startsWith(l.href + "/")
                  ? "bg-accent text-white"
                  : "text-white/80 hover:bg-white/10"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <div className="px-3 pb-2 text-xs text-white/60">
            {name}
            <br />
            <span className="uppercase tracking-wide text-[10px]">{role.replace("_", " ")}</span>
          </div>
          <form action="/logout" method="post">
            <button className="w-full text-left px-3 py-2 rounded-md text-sm text-white/80 hover:bg-white/10">
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
