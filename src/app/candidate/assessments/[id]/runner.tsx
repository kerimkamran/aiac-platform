"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Card, Icon, ProgressBar } from "@/components/ui";
import { SwipeToConfirm } from "@/components/SwipeToConfirm";
import { AssessmentTimer } from "@/components/AssessmentTimer";

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
  totalQuestions,
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
  // Design-execution-plan Phase 2 / T2.5: the app chrome around this
  // component is English; the prompts/options below are generated in
  // whatever language the assessment was authored in (assessments.
  // content_language). Passed through so a screen reader switches voice
  // for the generated text specifically, without mislabeling the English
  // chrome (timer, "Question X of Y", buttons) around it -- WCAG 3.1.2.
  contentLanguage?: string | null;
}) {
  // undefined for English/unset content -- omitting `lang` there just
  // inherits the page's own (English) lang, which is already correct.
  const contentLangAttr = contentLanguage && contentLanguage !== "en" ? { lang: contentLanguage } : {};
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

  /* Integrity deterrents: block copy/cut/context-menu/print and common
     dev-tools / save shortcuts, and flag when the candidate leaves the tab.
     Note: these are best-effort client-side deterrents. No website can fully
     prevent an OS-level screenshot, screen recording, or a second device.
     Design-execution-plan Phase 4 / T4.3: these used to fire regardless of
     what was focused, which meant a candidate typing their own answer
     couldn't paste a drafted response back into the textarea, couldn't copy
     their own in-progress text to paste it into the next question, and lost
     any assistive input method (voice dictation, some switch-access and IME
     tools) that inserts text via a synthetic paste. None of that helps
     integrity -- the risk this deterrent is for is copying the *prompt* off
     the page, not the candidate's own typing -- so paste/copy/cut/selection
     are now only blocked when the focused element isn't a text field. */
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

  // Refs mirroring the latest answers/tabSwitches so doSubmit can read
  // current values without needing them in its dependency list -- those two
  // change on every keystroke and every tab switch, and this is the ONE
  // submit function used both by the manual "slide to submit" action and by
  // the countdown's auto-submit-on-expiry below. Design-execution-plan
  // Phase 0 / T0.1: this used to be a useMemo depending on [answers, ...,
  // tabSwitches], which meant a brand new function on every keystroke --
  // and the countdown effect below depended on it, so it was torn down and
  // rebuilt on every keystroke too. Worse, a *second*, independent expiry
  // path lived in AssessmentTimer's onExpire callback, built with an
  // incompatible payload shape (`answers/tabSwitches` fields) that the
  // server action never reads (it reads `q_<questionId>`/`tab_switch_count`
  // -- see actions.ts). AssessmentTimer's effect ran its expiry check
  // synchronously on mount, so reopening an already-expired assessment
  // fired that broken path before this correct one ever got a chance to
  // run, silently submitting an empty paper. Fix: one payload builder, used
  // by exactly one expiry trigger (this component's own countdown, right
  // below); AssessmentTimer is now purely a display and owns no expiry
  // logic at all.
  const answersRef = useRef(answers);
  const tabSwitchesRef = useRef(tabSwitches);
  useEffect(() => {
    answersRef.current = answers;
    tabSwitchesRef.current = tabSwitches;
  }, [answers, tabSwitches]);

  // Design-execution-plan Phase 6 / T6.4: the submitted page used to
  // celebrate every submission the same way, including one the countdown
  // forced through at zero -- which reads as tone-deaf, not delightful, to
  // someone who ran out of time. `reason` travels in the form payload so the
  // server action (and the page it redirects to) can tell the two apart and
  // never render a celebratory "you did it" for a timer-expiry submit.
  const doSubmit = useCallback(
    (reason: "manual" | "expiry" = "manual") => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      const fd = new FormData();
      for (const s of steps) fd.set(`q_${s.q.id}`, answersRef.current[s.q.id] || "");
      fd.set("tab_switch_count", String(tabSwitchesRef.current));
      fd.set("submit_reason", reason);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      startTransition(() => submitAction(fd));
    },
    [steps, storageKey, submitAction]
  );

  /* Countdown — auto-submit on expiry. This is the single source of truth
     for what happens at zero; nothing else in this tree triggers a submit
     on expiry (see the T0.1 note on doSubmit above). */
  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((deadlineMs - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(t);
        doSubmit("expiry");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadlineMs, doSubmit]);

  const answered = steps.filter((s) => (answers[s.q.id] || "").trim().length > 0).length;
  // Design-execution-plan Phase 4 / T4.4: a single "X of Y answered" count
  // hides that MCQs (already grouped first in `steps`, see the module-level
  // comment on Step) take a couple of seconds each while written answers can
  // take minutes -- a candidate at "8 of 10" with two open questions left has
  // very different work ahead than one with two MCQs left. Composing the
  // existing ordering into two honest counts, not building a second one.
  const mcqSteps = steps.filter((s) => s.q.type === "mcq");
  const writtenSteps = steps.filter((s) => s.q.type !== "mcq");
  const mcqAnswered = mcqSteps.filter((s) => (answers[s.q.id] || "").trim().length > 0).length;
  const writtenAnswered = writtenSteps.filter((s) => (answers[s.q.id] || "").trim().length > 0).length;
  const current = steps[idx];
  const set = (qid: string, val: string) => setAnswers((a) => ({ ...a, [qid]: val }));

  /* Keyboard-first navigation: A-D (or 1-4) selects an MCQ option, Enter
     advances (or opens review on the last question), Left/Right steps
     between questions. Disabled while typing in a free-text answer so it
     never fights with normal text entry. */
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
      if (e.key === "Enter") {
        e.preventDefault();
        if (idx < steps.length - 1) setIdx((i) => Math.min(steps.length - 1, i + 1));
        else setReviewing(true);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setIdx((i) => Math.min(steps.length - 1, i + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, idx, steps.length, reviewing]);
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
    <>
      <AssessmentTimer deadlineMs={deadlineMs} totalQuestions={totalQuestions} />
      <div className="no-copy relative p-5 lg:p-10 max-w-3xl mx-auto">
      <div className="watermark-overlay" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
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
            <p className="text-2xs text-muted">
              {mcqSteps.length > 0 && writtenSteps.length > 0
                ? `${mcqAnswered} of ${mcqSteps.length} quick questions · ${writtenAnswered} of ${writtenSteps.length} written answers`
                : `${answered} of ${steps.length} answered`}{" "}
              · autosaves as you type
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 text-sm font-bold tabular-nums px-3.5 py-2 rounded-xl ring-1 ring-inset shrink-0 ${
              // Design-execution-plan Phase 4 / T4.5: amber `warning`, not
              // `critical`/red -- a countdown running low isn't a failure
              // state, and T0.1 already guarantees a safe auto-submit at 0:00.
              low ? "bg-warning/10 text-warning ring-warning/30" : "bg-surface text-foreground ring-line"
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
                      <span className="w-5 h-5 rounded-full bg-brand-deep text-white grid place-items-center shrink-0">
                        <Icon name="check" className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full ring-2 ring-inset ring-amber-400 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate" {...contentLangAttr}>
                        {i + 1}. {s.q.prompt}
                      </p>
                      <p
                        className={`text-xs truncate ${val ? "text-muted" : "text-amber-600 font-medium"}`}
                        {...(val && s.q.type === "mcq" ? contentLangAttr : {})}
                      >
                        {val ? (s.q.type === "mcq" ? optText : val) : "Not answered yet"}
                      </p>
                    </div>
                    <Icon name="arrowRight" className="w-4 h-4 text-muted shrink-0" />
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
            <div className="flex-1">
              <SwipeToConfirm
                label={
                  isPending
                    ? "Submitting…"
                    : answered < steps.length
                      ? `Answer ${steps.length - answered} more to submit`
                      : "Slide to submit assessment"
                }
                onConfirm={doSubmit}
                disabled={answered < steps.length || isPending}
                tone="brand"
                icon="send"
                height={52}
                className="w-full"
              />
            </div>
          </div>
        </div>
      ) : (
        /* ---------- Question stepper ---------- */
        <div className="anim-fade-in" key={current.q.id}>
          <p className="text-2xs font-bold uppercase tracking-[0.16em] text-accent-dark mb-2">
            Section {current.sectionIndex + 1} · {current.sectionTitle}
          </p>
          <Card className="p-6 md:p-8">
            <p className="text-xs text-muted font-semibold mb-3 tabular-nums">
              Question {idx + 1} of {steps.length}
            </p>
            <p className="text-lg font-semibold text-foreground leading-relaxed mb-6" {...contentLangAttr}>
              {current.q.prompt}
            </p>

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
                        className={`w-6 h-6 rounded-lg grid place-items-center text-2xs font-bold shrink-0 ${
                          selected ? "bg-brand-deep text-white" : "bg-background text-muted ring-1 ring-inset ring-line"
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className={selected ? "font-medium text-foreground" : "text-foreground"} {...contentLangAttr}>
                        {opt.text}
                      </span>
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
                  className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-sm leading-relaxed placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                />
                <p className="text-2xs text-muted mt-2 tabular-nums">
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

            <div className="hidden sm:flex items-center flex-wrap justify-center">
              {/* Design-execution-plan Phase 4 / T4.2: the dot itself stays a
                  small 10px visual, but the clickable button around it is
                  24x24 -- WCAG 2.5.8. */}
              {steps.map((s, i) => (
                <button
                  key={s.q.id}
                  onClick={() => setIdx(i)}
                  aria-label={`Go to question ${i + 1}`}
                  aria-current={i === idx ? "step" : undefined}
                  className="w-6 h-6 grid place-items-center shrink-0"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      i === idx ? "bg-brand scale-125" : (answers[s.q.id] || "").trim() ? "bg-accent" : "bg-line"
                    }`}
                  />
                </button>
              ))}
            </div>

            {idx < steps.length - 1 ? (
              <button
                onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}
                className="inline-flex items-center gap-2 bg-brand-deep text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand transition-colors"
              >
                Next
                <Icon name="arrowRight" className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setReviewing(true)}
                className="inline-flex items-center gap-2 bg-brand-deep text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent-dark transition-colors"
              >
                Review &amp; submit
                <Icon name="checkCircle" className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="text-2xs text-muted mt-4 flex items-center gap-1.5">
            <Icon name="keyboard" className="w-3 h-3 shrink-0" />
            {current.q.type === "mcq"
              ? "Press A\u2013D to choose an answer, Enter for next, \u2190 \u2192 to navigate."
              : "Press Enter to continue, \u2190 \u2192 to navigate between questions."}
          </p>

          {description && idx === 0 && <p className="text-xs text-muted mt-3 max-w-lg">{description}</p>}
        </div>
      )}
    </div>
    </>
  );
}
