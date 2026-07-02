"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Card, Icon, ProgressBar } from "@/components/ui";

export type RunnerSection = {
  id: string;
  title: string;
  questions: { id: string; type: string; prompt: string; options: { key: string; text: string }[] }[];
};

type Step = { sectionTitle: string; sectionIndex: number; q: RunnerSection["questions"][number] };

export function AssessmentRunner({
  caId,
  title,
  description,
  deadlineMs,
  sections,
  submitAction,
  watermarkLabel = "confidential",
}: {
  caId: string;
  title: string;
  description: string;
  deadlineMs: number;
  sections: RunnerSection[];
  submitAction: (formData: FormData) => Promise<void>;
  watermarkLabel?: string;
}) {
  const steps: Step[] = useMemo(
    () => sections.flatMap((s, si) => s.questions.map((q) => ({ sectionTitle: s.title, sectionIndex: si, q }))),
    [sections]
  );

  const storageKey = `aiac-answers-${caId}`;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.round((deadlineMs - Date.now()) / 1000)));
  const [isPending, startTransition] = useTransition();
  const submittedRef = useRef(false);

  /* Restore autosaved answers */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage after mount
      if (saved) setAnswers(JSON.parse(saved));
    } catch {}
  }, [storageKey]);

  /* Autosave */
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch {}
  }, [answers, storageKey]);

  /* Integrity deterrents: block copy/cut/paste/context-menu/print and common
     dev-tools / save shortcuts, and flag when the candidate leaves the tab.
     Note: these are best-effort client-side deterrents. No website can fully
     prevent an OS-level screenshot, screen recording, or a second device. */
  const [tabSwitches, setTabSwitches] = useState(0);
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && ["c", "x", "v", "p", "s", "u"].includes(k)) e.preventDefault();
      if (e.key === "PrintScreen") e.preventDefault();
      if (mod && e.shiftKey && ["i", "j", "c"].includes(k)) e.preventDefault();
      if (e.key === "F12") e.preventDefault();
    };
    const onVisibility = () => {
      if (document.hidden) setTabSwitches((n) => n + 1);
    };
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("selectstart", block);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("selectstart", block);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const doSubmit = useMemo(
    () => () => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      const fd = new FormData();
      for (const s of steps) fd.set(`q_${s.q.id}`, answers[s.q.id] || "");
      fd.set("tab_switch_count", String(tabSwitches));
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      startTransition(() => submitAction(fd));
    },
    [answers, steps, storageKey, submitAction, tabSwitches]
  );

  /* Countdown — auto-submit on expiry */
  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((deadlineMs - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(t);
        doSubmit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadlineMs, doSubmit]);

  const answered = steps.filter((s) => (answers[s.q.id] || "").trim().length > 0).length;
  const current = steps[idx];
  const set = (qid: string, val: string) => setAnswers((a) => ({ ...a, [qid]: val }));
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const low = secondsLeft < 300;

  if (steps.length === 0) {
    return (
      <div className="p-10 max-w-2xl">
        <Card className="p-8 text-center text-sm text-muted">This assessment has no questions yet. Contact your recruiter.</Card>
      </div>
    );
  }

  return (
    <div className="no-copy relative p-5 lg:p-10 max-w-3xl mx-auto">
      <div className="watermark-overlay" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="row">
            {watermarkLabel} · {new Date().toLocaleDateString()} · {caId.slice(0, 8)}
          </div>
        ))}
      </div>

      {tabSwitches > 0 && (
        <div className="mb-4 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <Icon name="eye" className="w-3.5 h-3.5 shrink-0" />
          This tab was left {tabSwitches} time{tabSwitches > 1 ? "s" : ""} during the assessment. This is logged for
          the reviewing admin.
        </div>
      )}

      {/* Sticky header: title, timer, progress */}
      <div className="sticky top-12 lg:top-0 z-30 -mx-5 lg:-mx-10 px-5 lg:px-10 pt-3 pb-4 bg-background/95 backdrop-blur border-b border-line mb-8">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="min-w-0">
            <h1 className="font-bold text-foreground truncate [font-family:var(--font-display)]">{title}</h1>
            <p className="text-[11.5px] text-faint">
              {answered} of {steps.length} answered · autosaves as you type
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 text-sm font-bold tabular-nums px-3.5 py-2 rounded-xl ring-1 ring-inset shrink-0 ${
              low ? "bg-red-50 text-critical ring-red-200" : "bg-surface text-foreground ring-line"
            }`}
            aria-live="polite"
          >
            <Icon name="timer" className="w-4 h-4" />
            {mins}:{String(secs).padStart(2, "0")}
          </span>
        </div>
        <ProgressBar value={(answered / steps.length) * 100} className="h-1.5" />
      </div>

      {reviewing ? (
        /* ---------- Review screen ---------- */
        <div className="anim-fade-up">
          <h2 className="text-xl font-bold text-foreground mb-1.5 [font-family:var(--font-display)]">Review your answers</h2>
          <p className="text-sm text-muted mb-6">
            Check everything looks right — once submitted, the AI engine scores your responses and answers can&apos;t be changed.
          </p>
          <div className="space-y-2.5 mb-8">
            {steps.map((s, i) => {
              const val = (answers[s.q.id] || "").trim();
              const optText = s.q.options.find((o) => o.key === val)?.text;
              return (
                <button
                  key={s.q.id}
                  onClick={() => {
                    setReviewing(false);
                    setIdx(i);
                  }}
                  className="w-full text-left bg-surface border border-line rounded-xl px-4 py-3 hover:border-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {val ? (
                      <span className="w-5 h-5 rounded-full bg-accent text-white grid place-items-center shrink-0">
                        <Icon name="check" className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full ring-2 ring-inset ring-amber-400 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground truncate">
                        {i + 1}. {s.q.prompt}
                      </p>
                      <p className={`text-xs truncate ${val ? "text-muted" : "text-amber-600 font-medium"}`}>
                        {val ? (s.q.type === "mcq" ? optText : val) : "Not answered yet"}
                      </p>
                    </div>
                    <Icon name="arrowRight" className="w-4 h-4 text-faint shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setReviewing(false)}
              className="inline-flex items-center gap-2 border border-line px-5 py-3 rounded-xl text-sm font-semibold text-foreground hover:border-brand transition-colors"
            >
              <Icon name="arrowLeft" className="w-4 h-4" />
              Keep editing
            </button>
            <button
              onClick={doSubmit}
              disabled={answered < steps.length || isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-brand text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="send" className="w-4 h-4" />
              {isPending ? "Submitting…" : answered < steps.length ? `Answer ${steps.length - answered} more to submit` : "Submit assessment"}
            </button>
          </div>
        </div>
      ) : (
        /* ---------- Question stepper ---------- */
        <div className="anim-fade-in" key={current.q.id}>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent-dark mb-2">
            Section {current.sectionIndex + 1} · {current.sectionTitle}
          </p>
          <Card className="p-6 md:p-8">
            <p className="text-xs text-faint font-semibold mb-3 tabular-nums">
              Question {idx + 1} of {steps.length}
            </p>
            <p className="text-lg font-semibold text-foreground leading-relaxed mb-6">{current.q.prompt}</p>

            {current.q.type === "mcq" ? (
              <div className="space-y-2.5" role="radiogroup">
                {current.q.options.map((opt) => {
                  const selected = answers[current.q.id] === opt.key;
                  return (
                    <label
                      key={opt.key}
                      className={`flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-sm cursor-pointer border transition-all ${
                        selected
                          ? "border-accent bg-accent-soft ring-1 ring-accent"
                          : "border-line bg-surface hover:border-faint"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q_${current.q.id}`}
                        value={opt.key}
                        checked={selected}
                        onChange={() => set(current.q.id, opt.key)}
                        className="sr-only"
                      />
                      <span
                        className={`w-6 h-6 rounded-lg grid place-items-center text-[11px] font-bold shrink-0 ${
                          selected ? "bg-accent text-white" : "bg-background text-muted ring-1 ring-inset ring-line"
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className={selected ? "font-medium text-foreground" : "text-foreground"}>{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div>
                <textarea
                  value={answers[current.q.id] || ""}
                  onChange={(e) => set(current.q.id, e.target.value)}
                  rows={7}
                  placeholder="Describe a specific situation, the action you took, and the result…"
                  className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-sm leading-relaxed placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                />
                <p className="text-[11px] text-faint mt-2 tabular-nums">
                  {(answers[current.q.id] || "").trim().split(/\s+/).filter(Boolean).length} words — aim for a concrete
                  situation → action → result story.
                </p>
              </div>
            )}
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 gap-4">
            <button
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="inline-flex items-center gap-2 border border-line px-4 py-2.5 rounded-xl text-sm font-semibold text-foreground hover:border-brand transition-colors disabled:opacity-40"
            >
              <Icon name="arrowLeft" className="w-4 h-4" />
              Back
            </button>

            <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-center">
              {steps.map((s, i) => (
                <button
                  key={s.q.id}
                  onClick={() => setIdx(i)}
                  aria-label={`Go to question ${i + 1}`}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === idx ? "bg-brand scale-125" : (answers[s.q.id] || "").trim() ? "bg-accent" : "bg-line"
                  }`}
                />
              ))}
            </div>

            {idx < steps.length - 1 ? (
              <button
                onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}
                className="inline-flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-light transition-colors"
              >
                Next
                <Icon name="arrowRight" className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setReviewing(true)}
                className="inline-flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent-dark transition-colors"
              >
                Review &amp; submit
                <Icon name="checkCircle" className="w-4 h-4" />
              </button>
            )}
          </div>

          {description && idx === 0 && <p className="text-xs text-faint mt-6 max-w-lg">{description}</p>}
        </div>
      )}
    </div>
  );
}
