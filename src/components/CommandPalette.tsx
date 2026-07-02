"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import type { NavLink } from "@/components/NavShell";

export function CommandPalette({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const router = useRouter();

  const openPalette = () => {
    setQuery("");
    setActiveIdx(0);
    setOpen(true);
  };
  const closePalette = () => setOpen(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (!o) {
            setQuery("");
            setActiveIdx(0);
          }
          return !o;
        });
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return links;
    return links.filter((l) => l.label.toLowerCase().includes(needle));
  }, [links, query]);

  const go = (href: string) => {
    closePalette();
    router.push(href);
  };

  if (!open) {
    return (
      <button
        onClick={openPalette}
        className="hidden lg:flex items-center gap-2 text-[12.5px] font-medium text-white/50 hover:text-white/80 transition-colors px-3 py-2 rounded-xl border border-white/10 hover:border-white/20 mx-3 mb-2"
      >
        <Icon name="search" className="w-3.5 h-3.5" />
        Quick jump
        <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-semibold bg-white/10 px-1.5 py-0.5 rounded">
          <Icon name="command" className="w-2.5 h-2.5" />K
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4">
      <div className="absolute inset-0 bg-black/50 anim-fade-in" onClick={closePalette} />
      <div className="relative w-full max-w-lg bg-surface rounded-2xl shadow-2xl border border-line overflow-hidden anim-fade-up">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line">
          <Icon name="search" className="w-4 h-4 text-faint shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => Math.max(0, i - 1));
              }
              if (e.key === "Enter" && filtered[activeIdx]) {
                go(filtered[activeIdx].href);
              }
            }}
            placeholder="Jump to…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          <kbd className="text-[10px] text-faint border border-line rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {filtered.map((l, i) => (
            <button
              key={l.href}
              onClick={() => go(l.href)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${
                i === activeIdx ? "bg-accent-soft text-accent-dark" : "text-foreground hover:bg-background"
              }`}
            >
              <Icon name={l.icon} className="w-4 h-4 shrink-0" />
              {l.label}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-faint">No matches.</p>}
        </div>
      </div>
    </div>
  );
}
