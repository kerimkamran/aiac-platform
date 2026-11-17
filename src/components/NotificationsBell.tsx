"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui";
import { useShellText } from "@/components/shell-i18n";
import { fillText, formatDateTimeIn } from "@/lib/dates";

type Note = { id: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string };

export function NotificationsBell() {
  const { lang, text } = useShellText();
  const w = text.notifications;
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const pathname = usePathname();
  const unread = unreadTotal;

  // Loaded on mount, on every page change and when the tab regains focus, so the
  // badge does not stay stale for the whole session (UX-B-13).
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const supabase = createClient();
      supabase
        .from("notifications")
        .select("id, title, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(12)
        .then(({ data }) => {
          if (!cancelled) setNotes((data as Note[]) || []);
        });
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null)
        .then(({ count }) => {
          if (!cancelled) setUnreadTotal(count ?? 0);
        });
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", load);
    };
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const markRead = async (id: string) => {
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: now }).eq("id", id).is("read_at", null);
    setNotes((n) => n.map((x) => (x.id === id ? { ...x, read_at: x.read_at || now } : x)));
    setUnreadTotal((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: now }).is("read_at", null);
    setNotes((n) => n.map((x) => ({ ...x, read_at: x.read_at || now })));
    setUnreadTotal(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${w.title}${unread ? ` (${fillText(w.unread, { n: unread })})` : ""}`}
        className="press relative inline-flex items-center justify-center w-11 h-11 rounded-md text-muted hover:text-foreground hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Icon name="bell" className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1 min-w-5 h-5 px-1 rounded-full bg-critical text-on-critical text-xs font-semibold grid place-items-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="anim-menu absolute right-0 mt-1 w-[min(20rem,calc(100vw-2rem))] bg-surface text-foreground border border-line rounded-xl shadow-md z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="text-sm font-semibold text-foreground">{w.title}</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-sm font-semibold text-accent hover:underline">
                {w.markAllRead}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-line-soft">
            {notes.map((note) => (
              <div key={note.id} className={`px-4 py-3 ${!note.read_at ? "bg-accent-soft" : ""}`}>
                <p className="text-sm font-semibold text-foreground">{note.title}</p>
                {note.body && <p className="text-sm text-muted mt-0.5">{note.body}</p>}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-muted">{formatDateTimeIn(lang, note.created_at)}</span>
                  {note.link && (
                    <Link href={note.link} className="text-sm font-semibold text-accent hover:underline" onClick={() => {
                        setOpen(false);
                        if (!note.read_at) void markRead(note.id);
                      }}
                    >
                      {w.open}
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {notes.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">{w.nothingYet}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
