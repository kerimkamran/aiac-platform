"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Icon } from "@/components/ui";
import type { NavLink } from "@/components/NavShell";

const RECENTS_KEY = "aiac-recent-nav";
const MAX_RECENTS = 5;
const GROUP_ORDER = ["Recent", "Quick actions", "Pages", "People & assessments"] as const;

type Group = (typeof GROUP_ORDER)[number];
type Item = NavLink & { group: Group; sublabel?: string };
type ScoredItem = Item & { positions: number[] };
type RemoteItem = { label: string; sublabel?: string; href: string; icon: string };

/** Ordered subsequence fuzzy match — every query char must appear in text, in
 *  order, but not necessarily adjacent. Score rewards early + consecutive hits
 *  so "peop" beats a scattered match for the same string. */
function fuzzyMatch(text: string, query: string): { score: number; positions: number[] } | null {
  if (!query) return { score: 0, positions: [] };
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let ti = 0;
  let score = 0;
  let consecutive = 0;
  const positions: number[] = [];
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti);
    if (idx === -1) return null;
    positions.push(idx);
    if (idx === ti) {
      consecutive += 1;
      score += 3 + consecutive;
    } else {
      consecutive = 0;
      score += 1;
    }
    score -= (idx - ti) * 0.05;
    ti = idx + 1;
  }
  if (t.startsWith(q)) score += 10;
  return { score, positions };
}

function HighlightMatch({ text, positions }: { text: string; positions: number[] }) {
  if (positions.length === 0) return <>{text}</>;
  const marked = new Set(positions);
  return (
    <>
      {text.split("").map((ch, i) =>
        marked.has(i) ? (
          <span key={i} className="text-accent-dark font-bold">
            {ch}
          </span>
        ) : (
          <span key={i}>{ch}</span>
        )
      )}
    </>
  );
}

export function CommandPalette({ links, actions = [] }: { links: NavLink[]; actions?: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [recents, setRecents] = useState<NavLink[]>([]);
  const [remote, setRemote] = useState<RemoteItem[]>([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  /* Debounced entity search (candidates, assessments) while the palette is
   * open. Cleanup cancels both the pending timer and any in-flight request,
   * so stale responses can never overwrite newer ones. */
  useEffect(() => {
    const needle = query.trim();
    if (!open || needle.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(needle)}`, { signal: controller.signal });
        const json = res.ok ? await res.json() : { results: [] };
        setRemote(Array.isArray(json.results) ? json.results : []);
      } catch {
        if (!controller.signal.aborted) setRemote([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  /* Track recently visited nav destinations in localStorage (MRU, deduped). */
  useEffect(() => {
    try {
      const known = [...links, ...actions];
      const match = known.find((l) => l.href === pathname);
      const raw = localStorage.getItem(RECENTS_KEY);
      const stored: NavLink[] = raw ? JSON.parse(raw) : [];
      const next = match
        ? [match, ...stored.filter((r) => r.href !== match.href)].slice(0, MAX_RECENTS)
        : stored.slice(0, MAX_RECENTS);
      if (match) localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on route change
      setRecents(next);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const openPalette = () => {
    setQuery("");
    setActiveIdx(0);
    setRemote([]);
    setSearching(false);
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
            setRemote([]);
            setSearching(false);
          }
          return !o;
        });
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const items: Item[] = useMemo(() => {
    const recentItems: Item[] = recents.map((r) => ({ ...r, group: "Recent" }));
    const actionItems: Item[] = actions.map((a) => ({ ...a, group: "Quick actions" }));
    const pageItems: Item[] = links.map((l) => ({ ...l, group: "Pages" }));
    return [...recentItems, ...actionItems, ...pageItems];
  }, [recents, actions, links]);

  /** Final flat, group-ordered, deduped, index-stable list — computed once per
   *  render pass so no state mutation happens inside JSX. */
  const displayList: ScoredItem[] = useMemo(() => {
    const needle = query.trim();
    const seen = new Set<string>();
    const withScore: (ScoredItem & { score: number })[] = [];
    for (const it of items) {
      if (seen.has(it.href)) continue;
      const m = fuzzyMatch(it.label, needle);
      if (!m) continue;
      seen.add(it.href);
      withScore.push({ ...it, score: m.score, positions: m.positions });
    }
    if (needle) {
      // Best matches first, grouped headers still rendered in GROUP_ORDER below
      // but relative ranking within a group follows match score.
      withScore.sort((a, b) => b.score - a.score);
    }
    // Remote entities keep server order — the server already ranked them, and
    // they matched on fields (email) that aren't in the visible label.
    for (const r of remote) {
      if (seen.has(r.href)) continue;
      seen.add(r.href);
      withScore.push({ ...r, group: "People & assessments", score: 0, positions: [] });
    }
    return GROUP_ORDER.flatMap((g) => withScore.filter((it) => it.group === g));
  }, [items, query, remote]);

  const go = (href: string) => {
    closePalette();
    router.push(href);
  };

  // Async results can shrink the list under the cursor — keep the highlight valid.
  const active = Math.min(activeIdx, Math.max(0, displayList.length - 1));

  if (!open) {
    return (
      <button
        onClick={openPalette}
        className="hidden lg:flex items-center gap-2 text-[12.5px] font-medium text-faint hover:text-muted transition-colors px-3 py-2 rounded-xl border border-line bg-surface hover:border-faint/40 mx-3 mt-3 mb-1 w-[calc(100%-1.5rem)]"
      >
        <Icon name="search" className="w-3.5 h-3.5" />
        Quick jump
        <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-semibold bg-line/60 px-1.5 py-0.5 rounded">
          <Icon name="command" className="w-2.5 h-2.5" />K
        </span>
      </button>
    );
  }

  const groups = GROUP_ORDER.map((g) => ({
    label: g,
    rows: displayList
      .map((it, i) => ({ ...it, idx: i }))
      .filter((it) => it.group === g),
  })).filter((g) => g.rows.length > 0);

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
              if (e.target.value.trim().length >= 2) {
                setSearching(true);
              } else {
                setSearching(false);
                setRemote([]);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((i) => Math.min(displayList.length - 1, i + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => Math.max(0, i - 1));
              }
              if (e.key === "Enter" && displayList[active]) {
                go(displayList[active].href);
              }
            }}
            placeholder="Jump to a page or action…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          <kbd className="text-[10px] text-faint border border-line rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {groups.map(({ label, rows }) => (
            <div key={label} className="mb-1.5 last:mb-0">
              <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint flex items-center gap-1.5">
                {label === "Recent" && <Icon name="history" className="w-3 h-3" />}
                {label}
              </p>
              {rows.map((l) => (
                <button
                  key={l.href}
                  onClick={() => go(l.href)}
                  onMouseEnter={() => setActiveIdx(l.idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${
                    l.idx === active ? "bg-accent-soft text-accent-dark" : "text-foreground hover:bg-background"
                  }`}
                >
                  <Icon name={l.icon} className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    <HighlightMatch text={l.label} positions={l.positions} />
                  </span>
                  {l.sublabel && <span className="ml-auto text-xs text-faint truncate max-w-48">{l.sublabel}</span>}
                </button>
              ))}
            </div>
          ))}
          {searching && (
            <p className="px-3 py-2.5 text-xs text-faint flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-line border-t-accent-dark animate-spin" />
              Searching people &amp; assessments…
            </p>
          )}
          {displayList.length === 0 && !searching && <p className="px-3 py-6 text-center text-sm text-faint">No matches.</p>}
        </div>
      </div>
    </div>
  );
}
