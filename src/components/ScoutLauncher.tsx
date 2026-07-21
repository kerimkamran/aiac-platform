"use client";

// Scout: Vantage's app-wide guide. A persistent floating launcher, present on
// every page for every audience (public visitors included), that answers
// "how do I..." questions and can actually navigate the user to the right
// place -- not just explain where it is. Scripted intents (scout-intents.ts)
// handle common navigation asks instantly and for free; anything unmatched
// falls back to a Kimi-powered conversational answer (scout-actions.ts).

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import { sendScoutMessage } from "@/app/scout-actions";
import { matchScoutIntent, type ScoutRole } from "@/lib/scout-intents";

type ScoutMessage = { role: "user" | "assistant"; content: string; navHref?: string; navLabel?: string };

const ROLE_GREETING: Record<ScoutRole, string> = {
  visitor: "Hi, I'm Scout. Ask me how Vantage works, or where to find something -- I can take you straight there.",
  candidate: "Hi, I'm Scout. Ask me things like \"where do I start my assessment\" or \"where can I see my results\".",
  staff: "Hi, I'm Scout. Ask me things like \"how do I invite a candidate\" or \"where's the review queue\" -- I'll open it for you.",
  decision_maker: "Hi, I'm Scout. Ask me about a candidate report, or where to find something in your queue.",
  admin: "Hi, I'm Scout. Ask me where to find users, roles, audit logs, or anything else in the Admin Panel.",
};

const ROLE_SUGGESTIONS: Record<ScoutRole, string[]> = {
  visitor: ["How does this work?", "What's the competency framework?", "I'm a candidate, where do I sign up?"],
  candidate: ["Where do I start my assessment?", "Where can I see my results?"],
  staff: ["How do I invite a candidate?", "Where's my review queue?", "How do I create a new assessment?"],
  decision_maker: ["What am I assigned to review?"],
  admin: ["Where do I manage user roles?", "Where's the audit log?"],
};

export function ScoutLauncher({ role }: { role: ScoutRole }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ScoutMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function goTo(href: string) {
    // router.push handles both real routes and same-page "/#anchor" hash
    // links (Next scrolls to the element client-side without a full reload).
    router.push(href);
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");

    const intent = matchScoutIntent(trimmed, role);
    if (intent) {
      setMessages((m) => [...m, { role: "assistant", content: intent.explain, navHref: intent.href, navLabel: intent.label }]);
      return;
    }

    startTransition(async () => {
      try {
        const history = messages.map((m) => ({ role: m.role, content: m.content }));
        const reply = await sendScoutMessage(role, [...history, { role: "user" as const, content: trimmed }]);
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages((m) => [...m, { role: "assistant", content: `Sorry, I couldn't reach my AI fallback (${msg}). Try rephrasing, or use the menu directly.` }]);
      }
    });
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Scout" : "Open Scout, your guide"}
        className="no-print fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full grid place-items-center text-white transition-transform hover:scale-105 active:scale-95"
        style={{
          background: "var(--foreground)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <Icon name={open ? "x" : "sparkles"} className="w-6 h-6" />
      </button>

      {/* Panel */}
      {open && (
        <div className="no-print fixed bottom-24 right-5 z-40 w-[calc(100vw-2.5rem)] sm:w-[380px] max-h-[70vh] bg-surface squircle-lg flex flex-col anim-fade-up overflow-hidden" style={{ boxShadow: "var(--shadow-lg)" }}>
          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3 shrink-0 text-white" style={{ background: "var(--foreground)" }}>
            <span className="w-8 h-8 rounded-full bg-white/20 grid place-items-center shrink-0">
              <Icon name="sparkles" className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-none">Scout</p>
              <p className="text-[11px] text-white/75 mt-1">Your Vantage guide</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <div>
                <p className="text-[13.5px] text-muted leading-relaxed mb-4">{ROLE_GREETING[role]}</p>
                <div className="flex flex-col gap-2">
                  {ROLE_SUGGESTIONS[role].map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-[13px] font-medium bg-background squircle-sm px-3.5 py-2.5 hover:bg-line-soft transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[88%]">
                    <div
                      className={`squircle-sm px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                        m.role === "user" ? "text-white" : "bg-background text-foreground"
                      }`}
                      style={m.role === "user" ? { background: "var(--foreground)" } : undefined}
                    >
                      {m.content}
                    </div>
                    {m.navHref && (
                      <button
                        onClick={() => goTo(m.navHref!)}
                        className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-dark hover:underline"
                      >
                        Open {m.navLabel}
                        <Icon name="arrowRight" className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            {pending && (
              <div className="flex justify-start">
                <div className="bg-background squircle-sm px-3.5 py-2.5 text-[13px] text-faint flex items-center gap-2">
                  <Icon name="sparkles" className="w-3.5 h-3.5 animate-pulse text-accent-dark" />
                  Thinking…
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-line-soft p-3 flex items-end gap-2 shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Scout anything…"
              disabled={pending}
              className="flex-1 bg-background squircle-sm px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label="Send"
              className="shrink-0 w-10 h-10 squircle-sm text-white grid place-items-center disabled:opacity-40 transition-opacity"
              style={{ background: "var(--foreground)" }}
            >
              <Icon name="send" className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
