"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui";

type Note = { id: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string };

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notes.filter((n) => !n.read_at).length;

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("notifications")
      .select("id, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data }) => setNotes((data as Note[]) || []));
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAllRead = async () => {
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: now }).is("read_at", null);
    setNotes((n) => n.map((x) => ({ ...x, read_at: x.read_at || now })));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="press relative inline-flex items-center justify-center w-11 h-11 rounded-md text-muted hover:text-foreground hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Icon name="bell" className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1 min-w-5 h-5 px-1 rounded-full bg-critical text-on-critical text-xs font-semibold grid place-items-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="anim-menu absolute right-0 mt-1 w-[min(20rem,calc(100vw-2rem))] bg-surface text-foreground border border-line rounded-xl shadow-md z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-sm font-semibold text-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-line-soft">
            {notes.map((n) => (
              <div key={n.id} className={`px-4 py-3 ${!n.read_at ? "bg-accent-soft" : ""}`}>
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                {n.body && <p className="text-sm text-muted mt-0.5">{n.body}</p>}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-muted">{new Date(n.created_at).toLocaleString()}</span>
                  {n.link && (
                    <Link href={n.link} className="text-sm font-semibold text-accent hover:underline" onClick={() => setOpen(false)}>
                      Open
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {notes.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">Nothing yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
