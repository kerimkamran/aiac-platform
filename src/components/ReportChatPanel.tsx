"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui";
import { useToast } from "@/components/Toaster";
import { getOrCreateReportThread, sendReportChatMessage } from "@/app/report-chat-actions";

type ChatMessage = { role: "user" | "assistant"; content: string; created_at?: string };

const QUICK_ACTIONS = [
  { label: "Summarize this report", prompt: "Give me a short summary of this candidate's report -- overall fit, top strengths, and biggest gaps." },
  { label: "Draft interview follow-ups", prompt: "Draft 3-4 interview follow-up questions that probe the weakest-scoring competencies in more depth." },
  { label: "Draft development suggestions", prompt: "Draft 2-3 concrete development suggestions tied to this person's specific competency gaps." },
  { label: "Draft decision rationale", prompt: "Draft a short, evidence-based written rationale I could attach to my decision, citing specific scores and quotes." },
];

export function ReportChatPanel({ candidateAssessmentId, candidateName }: { candidateAssessmentId: string; candidateName: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const { push } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || loaded) return;
    getOrCreateReportThread(candidateAssessmentId)
      .then((r) => {
        setThreadId(r.threadId);
        setMessages(r.messages);
        setLoaded(true);
      })
      .catch((e) => push("error", `Couldn't load chat: ${e instanceof Error ? e.message : String(e)}`));
  }, [open, loaded, candidateAssessmentId, push]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !threadId || pending) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");
    startTransition(async () => {
      try {
        const reply = await sendReportChatMessage(candidateAssessmentId, threadId, history, trimmed);
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
      } catch (e) {
        push("error", `AI didn't respond: ${e instanceof Error ? e.message : String(e)}`);
        setMessages((m) => m.slice(0, -1));
      }
    });
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="no-print inline-flex items-center gap-2 bg-accent text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-accent-dark transition-colors"
      >
        <Icon name="messageSquare" className="w-4 h-4" />
        Discuss with AI
      </button>

      {/* Backdrop + side panel */}
      {open && (
        <div className="no-print fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30 anim-fade-in" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-full sm:w-[440px] bg-surface shadow-2xl flex flex-col anim-fade-in">
            {/* Header */}
            <div className="bg-brand-deep px-5 py-4 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Kimi AI · Report chat</p>
                <p className="text-sm font-bold text-white truncate mt-0.5">{candidateName}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-white/60 hover:text-white p-1 -m-1 shrink-0">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {!loaded ? (
                <div className="flex items-center justify-center h-full text-sm text-faint gap-2">
                  <Icon name="clock" className="w-4 h-4 animate-pulse" />
                  Loading conversation…
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-muted mb-4">
                    Ask questions about this report, or use a quick action below. Every answer is grounded strictly in this candidate&apos;s actual scores and responses.
                  </p>
                  <div className="flex flex-col gap-2">
                    {QUICK_ACTIONS.map((qa) => (
                      <button
                        key={qa.label}
                        onClick={() => send(qa.prompt)}
                        className="text-left text-[13px] font-medium border border-line rounded-lg px-3.5 py-2.5 hover:border-accent hover:bg-accent-soft transition-colors"
                      >
                        {qa.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                        m.role === "user" ? "bg-brand text-white" : "bg-background border border-line text-foreground"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}
              {pending && (
                <div className="flex justify-start">
                  <div className="bg-background border border-line rounded-xl px-3.5 py-2.5 text-[13px] text-faint flex items-center gap-2">
                    <Icon name="sparkles" className="w-3.5 h-3.5 animate-pulse text-accent-dark" />
                    Thinking…
                  </div>
                </div>
              )}
            </div>

            {/* Quick actions once a conversation has started */}
            {loaded && messages.length > 0 && (
              <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto shrink-0">
                {QUICK_ACTIONS.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => send(qa.prompt)}
                    disabled={pending}
                    className="shrink-0 text-[11.5px] font-semibold border border-line rounded-full px-3 py-1.5 hover:border-accent hover:bg-accent-soft transition-colors disabled:opacity-50"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            )}

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-line p-3 flex items-end gap-2 shrink-0"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask about this report…"
                rows={1}
                disabled={!loaded || pending}
                className="flex-1 resize-none rounded-xl border border-line bg-background px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!loaded || pending || !input.trim()}
                aria-label="Send"
                className="shrink-0 w-10 h-10 rounded-xl bg-accent text-white grid place-items-center hover:bg-accent-dark transition-colors disabled:opacity-40"
              >
                <Icon name="send" className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
