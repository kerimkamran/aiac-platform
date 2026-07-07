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
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative p-2 rounded-xl border border-line bg-surface text-muted hover:text-foreground hover:border-faint/50 transition-colors"
      >
        <Icon name="mail" className="w-4.5 h-4.5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-critical text-white text-[10px] font-bold grid place-items-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-surface border border-line rounded-2xl shadow-xl z-50 overflow-hidden anim-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="text-[13px] font-bold text-foreground">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[12px] font-semibold text-accent-dark hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-line">
            {notes.map((n) => (
              <div key={n.id} className={`px-4 py-3 ${!n.read_at ? "bg-accent-soft/40" : ""}`}>
                <p className="text-[13px] font-semibold text-foreground">{n.title}</p>
                {n.body && <p className="text-[12px] text-muted mt-0.5">{n.body}</p>}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10.5px] text-faint">{new Date(n.created_at).toLocaleString()}</span>
                  {n.link && (
                    <Link href={n.link} className="text-[11.5px] font-semibold text-accent-dark hover:underline" onClick={() => setOpen(false)}>
                      Open
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {notes.length === 0 && <p className="px-4 py-8 text-center text-sm text-faint">Nothing yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
