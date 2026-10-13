"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { SwipeToConfirm } from "@/components/SwipeToConfirm";

export type RunnerSection = {
  id: string;
  title: string;
  questions: { id: string; type: string; prompt: string; options: { key: string; text: string }[] }[];
};

type Step = { sectionTitle: string; sectionIndex: number; q: RunnerSection["questions"][number] };

// Local draft: answers and flags are kept on this device until submit. The
// server only sees them on submit (see actions.ts). The key includes the
// candidate assessment id so two open assessments never mix answers.
type Draft = { answers: Record<string, string>; flagged: string[] };
const EMPTY_DRAFT: Draft = { answers: {}, flagged: [] };

function draftKey(caId: string) {
  return `aiac-exam-${caId}`;
}

// Drafts saved before the exam screen existed stored answers alone.
function readDraft(caId: string): Draft {
  try {
    const raw = localStorage.getItem(draftKey(caId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Draft>;
      return {
        answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {},
        flagged: Array.isArray(parsed.flagged) ? parsed.flagged : [],
      };
    }
    const legacy = localStorage.getItem(`aiac-answers-${caId}`);
    if (legacy) return { answers: JSON.parse(legacy) as Record<string, string>, flagged: [] };
  } catch {}
  return EMPTY_DRAFT;
}

export function AssessmentRunner({
  caId,
  title,
  deadlineMs,
  sections,
  submitAction,
  watermarkLabel = "confidential",
  contentLanguage,
}: {
  caId: string;
  title: string;
  description: string;
  deadlineMs: number;
  sections: RunnerSection[];
  submitAction: (formData: FormData) => Promise<void>;
  watermarkLabel?: string;
  totalQuestions: number;
  // The exam chrome is English; prompts and options are generated in the
  // assessment's own language (assessments.content_language). Marking them
  // with lang lets a screen reader switch voice for that text only (WCAG 3.1.2).
  contentLanguage?: string | null;
}) {
  // undefined for English/unset content -- omitting `lang` there just
  // inherits the page's own (English) lang, which is already correct.
  const contentLangAttr = contentLanguage && contentLanguage !== "en" ? { lang: contentLanguage } : {};
  const steps: Step[] = useMemo(
    () => sections.flatMap((s, si) => s.questions.map((q) => ({ sectionTitle: s.title, sectionIndex: si, q }))),
    [sections]
  );
  const total = steps.length;

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  // Null until mounted, so the server and first client render agree and the
  // countdown never shows a stale value during hydration.
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const submittedRef = useRef(false);
  const answers = draft.answers;
  const flaggedSet = useMemo(() => new Set(draft.flagged), [draft.flagged]);

  /* Restore the local draft once on mount, then keep it saved on this device. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage after mount
    setDraft(readDraft(caId));
    setRestored(true);
  }, [caId]);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(draftKey(caId), JSON.stringify(draft));
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stamps the save time after each change
    setSavedAt(Date.now());
  }, [draft, restored, caId]);

  /* Integrity deterrents: block copy/cut/context-menu/print and common
     dev-tools / save shortcuts, and flag when the candidate leaves the tab.
     These are best-effort client-side deterrents. No website can fully
     prevent an OS-level screenshot, screen recording, or a second device.
     Paste, copy and cut stay available inside text fields so a candidate can
     edit their own answer and use dictation or assistive input. */
  const [tabSwitches, setTabSwitches] = useState(0);
  useEffect(() => {
    const isTextField = (t: EventTarget | null) =>
      t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && !["radio", "checkbox"].includes(t.type));
    const block = (e: Event) => {
      if (!isTextField(e.target)) e.preventDefault();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && ["c", "x", "v"].includes(k) && !isTextField(e.target)) e.preventDefault();
      if (mod && ["p", "s", "u"].includes(k)) e.preventDefault();
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

  // Refs mirror the latest answers and tab-switch count so the one submit
  // function (manual slide or countdown expiry) reads current values without
  // being rebuilt on every keystroke.
  const answersRef = useRef(answers);
  const tabSwitchesRef = useRef(tabSwitches);
  useEffect(() => {
    answersRef.current = answers;
    tabSwitchesRef.current = tabSwitches;
  }, [answers, tabSwitches]);

  // `reason` travels in the form so the submitted page can show a calm
  // confirmation when the countdown forced the submit at zero.
  const doSubmit = useCallback(
    (reason: "manual" | "expiry" = "manual") => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      const fd = new FormData();
      for (const s of steps) fd.set(`q_${s.q.id}`, answersRef.current[s.q.id] || "");
      fd.set("tab_switch_count", String(tabSwitchesRef.current));
      fd.set("submit_reason", reason);
      try {
        localStorage.removeItem(draftKey(caId));
        localStorage.removeItem(`aiac-answers-${caId}`);
      } catch {}
      startTransition(() => submitAction(fd));
    },
    [steps, caId, submitAction]
  );

  /* Countdown: the single timer on screen, and the single source of truth for
     what happens at zero (an automatic submit). */
  // Waits for the draft to be restored: an assessment reopened after its
  // deadline must submit the answers already saved, never an empty paper.
  useEffect(() => {
    if (!restored) return;
    const tick = () => {
      const n = Date.now();
      setNowMs(n);
      if (Math.round((deadlineMs - n) / 1000) <= 0) doSubmit("expiry");
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadlineMs, doSubmit, restored]);

  const secondsLeft = nowMs === null ? null : Math.max(0, Math.round((deadlineMs - nowMs) / 1000));
  const low = secondsLeft !== null && secondsLeft < 300;
  const timeLabel =
    secondsLeft === null
      ? "--:--"
      : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  const answered = steps.filter((s) => (answers[s.q.id] || "").trim().length > 0).length;
  const flaggedCount = steps.filter((s) => flaggedSet.has(s.q.id)).length;
  const current = steps[idx];
  const set = useCallback((qid: string, val: string) => {
    setDraft((d) => ({ ...d, answers: { ...d.answers, [qid]: val } }));
  }, []);
  const toggleFlag = useCallback((qid: string) => {
    setDraft((d) => ({
      ...d,
      flagged: d.flagged.includes(qid) ? d.flagged.filter((x) => x !== qid) : [...d.flagged, qid],
    }));
  }, []);

  /* Keyboard-first navigation: A-D (or 1-4) selects an MCQ option, Enter
     advances (or opens review on the last question), arrows step between
     questions, F flags. Disabled while typing so it never fights with text. */
  useEffect(() => {
    if (reviewing || !current) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLInputElement && !["radio", "checkbox"].includes(target.type));
      if (isTyping) return;

      if (current.q.type === "mcq") {
        const key = e.key.toUpperCase();
        const optIdx = current.q.options.findIndex((o) => o.key.toUpperCase() === key);
        if (optIdx !== -1) {
          e.preventDefault();
          set(current.q.id, current.q.options[optIdx].key);
          return;
        }
        const numIdx = Number(e.key) - 1;
        if (Number.isInteger(numIdx) && current.q.options[numIdx]) {
          e.preventDefault();
          set(current.q.id, current.q.options[numIdx].key);
          return;
        }
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFlag(current.q.id);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (idx < total - 1) setIdx((i) => Math.min(total - 1, i + 1));
        else setReviewing(true);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setIdx((i) => Math.min(total - 1, i + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, idx, total, reviewing, set, toggleFlag]);

  const savedLabel =
    savedAt === null || nowMs === null
      ? "Saved on this device"
      : `Saved on this device · ${Math.max(0, Math.round((nowMs - savedAt) / 1000))} s ago`;

  if (total === 0) {
    return (
      <div className="mx-auto max-w-[680px] p-6 pt-16 text-center">
        <p className="text-base text-muted">This assessment has no questions yet. Contact your recruiter.</p>
        <Link href="/candidate/assessments" className="mt-6 inline-block text-sm font-semibold text-accent-dark hover:underline">
          Back to my assessments
        </Link>
      </div>
    );
  }

  return (
    <div className="exam-canvas no-copy min-h-dvh bg-background text-foreground">
      <div className="watermark-overlay" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="row">
            {watermarkLabel} · {new Date().toLocaleDateString()} · {caId.slice(0, 8)}
          </div>
        ))}
      </div>

      {/* One header: title, autosave status, the progress chain and the one timer. */}
      <header className="sticky top-0 z-30 border-b border-line bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1040px] items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold text-foreground sm:text-base">{title}</h1>
            <p className="truncate text-xs text-muted" aria-live="polite">
              {savedLabel}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold tabular-nums ring-1 ring-inset ${
              // Amber under five minutes, never red: running low is not a failure,
              // and the countdown always submits safely at zero.
              low ? "bg-warning-soft text-warning ring-warning/40" : "bg-surface text-foreground ring-line"
            }`}
          >
            <Icon name="timer" className="h-4 w-4" />
            <span aria-label={secondsLeft === null ? undefined : `${Math.ceil(secondsLeft / 60)} minutes remaining`}>{timeLabel}</span>
          </span>
          <Link
            href="/candidate/assessments"
            className="shrink-0 rounded-xl px-3 py-2.5 text-sm font-semibold text-accent-dark hover:bg-accent-soft"
          >
            Save &amp; exit
          </Link>
        </div>

        <nav aria-label="Questions" className="mx-auto max-w-[1040px] overflow-x-auto px-4 pb-2 sm:px-6">
          <ol className="flex min-w-max items-center gap-1">
            {steps.map((s, i) => {
              const isAnswered = (answers[s.q.id] || "").trim().length > 0;
              const isFlagged = flaggedSet.has(s.q.id);
              const isCurrent = !reviewing && i === idx;
              return (
                <li key={s.q.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewing(false);
                      setIdx(i);
                    }}
                    aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ", not answered"}${isFlagged ? ", flagged" : ""}`}
                    aria-current={isCurrent ? "step" : undefined}
                    className="relative grid h-11 w-11 place-items-center"
                  >
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold tabular-nums transition-colors ${
                        isAnswered
                          ? "bg-brand text-white"
                          : "bg-surface text-muted ring-1 ring-inset ring-line"
                      } ${isCurrent ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""}`}
                    >
                      {i + 1}
                    </span>
                    {isFlagged && (
                      <span aria-hidden className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-background" />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      {reviewing ? (
        /* ---------- Review: every question on one grid, then one submit ---------- */
        <main className="mx-auto max-w-[680px] px-5 pb-16 pt-10 sm:pt-14">
          <h2 className="text-2xl font-bold tracking-tight text-foreground [font-family:var(--font-display)]">Review your answers</h2>
          <p className="mt-2 text-base text-muted">
            {answered} of {total} answered
            {flaggedCount > 0 ? `, ${flaggedCount} flagged` : ""}. Select a question to go back to it. Once you submit, your
            answers can&apos;t be changed.
          </p>

          <ol className="mt-8 grid grid-cols-5 gap-2 sm:grid-cols-8">
            {steps.map((s, i) => {
              const isAnswered = (answers[s.q.id] || "").trim().length > 0;
              const isFlagged = flaggedSet.has(s.q.id);
              return (
                <li key={s.q.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewing(false);
                      setIdx(i);
                    }}
                    aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ", not answered"}${isFlagged ? ", flagged" : ""}`}
                    className={`relative grid h-11 w-full place-items-center rounded-xl text-sm font-bold tabular-nums transition-colors ${
                      isAnswered
                        ? "bg-brand text-white hover:bg-brand-hover"
                        : "bg-surface text-foreground ring-1 ring-inset ring-line-strong hover:ring-accent"
                    }`}
                  >
                    {i + 1}
                    {isFlagged && <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning" />}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-md bg-brand" /> Answered
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-md ring-1 ring-inset ring-line-strong" /> Not answered
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-warning" /> Flagged
            </span>
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setReviewing(false)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line px-5 text-sm font-semibold text-foreground transition-colors hover:border-brand"
            >
              <Icon name="arrowLeft" className="h-4 w-4" />
              Keep editing
            </button>
            <div className="flex-1">
              <SwipeToConfirm
                label={
                  isPending
                    ? "Submitting…"
                    : answered < total
                      ? `Answer ${total - answered} more to submit`
                      : "Slide to submit assessment"
                }
                onConfirm={doSubmit}
                disabled={answered < total || isPending}
                tone="brand"
                icon="send"
                height={52}
                className="w-full"
              />
            </div>
          </div>
        </main>
      ) : (
        /* ---------- One question at a time, at reading width ---------- */
        <main className="mx-auto max-w-[680px] px-5 pb-16 pt-8 sm:pt-12">
          {tabSwitches > 0 && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-soft px-4 py-2.5 text-sm font-medium text-warning">
              <Icon name="eye" className="h-4 w-4 shrink-0" />
              This tab was left {tabSwitches} time{tabSwitches > 1 ? "s" : ""}. This is logged for the reviewing admin.
            </div>
          )}

          <div key={current.q.id} className="anim-fade-in">
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold tabular-nums text-muted">
                Question {idx + 1} of {total}
                <span className="mx-2 text-line-strong" aria-hidden>
                  ·
                </span>
                <span className="font-medium">{current.sectionTitle}</span>
              </p>
              <button
                type="button"
                onClick={() => toggleFlag(current.q.id)}
                aria-pressed={flaggedSet.has(current.q.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition-colors ${
                  flaggedSet.has(current.q.id)
                    ? "bg-warning-soft text-warning ring-warning/50"
                    : "text-muted ring-line hover:text-foreground hover:ring-line-strong"
                }`}
              >
                <Icon name="flag" className="h-4 w-4" />
                {flaggedSet.has(current.q.id) ? "Flagged" : "Flag"}
              </button>
            </div>

            <h2 className="mb-8 text-xl font-semibold leading-relaxed text-foreground" {...contentLangAttr}>
              {current.q.prompt}
            </h2>

            {current.q.type === "mcq" ? (
              <div className="space-y-3" role="radiogroup" aria-label={`Answer options for question ${idx + 1}`}>
                {current.q.options.map((opt) => {
                  const selected = answers[current.q.id] === opt.key;
                  return (
                    <label
                      key={opt.key}
                      className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border px-4 py-3.5 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-accent ${
                        selected
                          ? "border-brand bg-accent-soft ring-1 ring-brand"
                          : "border-line bg-surface hover:border-line-strong"
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
                        aria-hidden
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                          selected ? "bg-brand text-white" : "bg-background text-foreground ring-1 ring-inset ring-line"
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className="text-base leading-snug text-foreground" {...contentLangAttr}>
                        {opt.text}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div>
                <label htmlFor={`answer-${current.q.id}`} className="sr-only">
                  Your answer
                </label>
                <textarea
                  id={`answer-${current.q.id}`}
                  value={answers[current.q.id] || ""}
                  onChange={(e) => set(current.q.id, e.target.value)}
                  rows={9}
                  placeholder="Describe a specific situation, the action you took, and the result…"
                  className="w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3.5 text-base leading-relaxed text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent"
                />
                <p className="mt-2 text-sm tabular-nums text-muted">
                  {(answers[current.q.id] || "").trim().split(/\s+/).filter(Boolean).length} words. Aim for a concrete
                  situation, the action you took, and the result.
                </p>
              </div>
            )}
          </div>

          <div className="mt-10 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line px-5 text-sm font-semibold text-foreground transition-colors hover:border-brand disabled:opacity-40"
            >
              <Icon name="arrowLeft" className="h-4 w-4" />
              Previous
            </button>

            {idx < total - 1 ? (
              <button
                type="button"
                onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-deep px-6 text-sm font-semibold text-white transition-colors hover:bg-brand"
              >
                Next
                <Icon name="arrowRight" className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setReviewing(true)}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-deep px-6 text-sm font-semibold text-white transition-colors hover:bg-brand"
              >
                Review answers
                <Icon name="checkCircle" className="h-4 w-4" />
              </button>
            )}
          </div>

          <p className="mt-8 flex items-center gap-2 text-sm text-muted">
            <Icon name="keyboard" className="h-4 w-4 shrink-0" />
            {current.q.type === "mcq"
              ? "Press A to D to choose, F to flag, Enter for next, arrow keys to move between questions."
              : "Press F to flag, Enter for next, arrow keys to move between questions."}
          </p>
        </main>
      )}
    </div>
  );
}
