"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui";
import { ProgressHorizon } from "@/components/horizon/ProgressHorizon";
import { getExamDeadline } from "./actions";
import { LOW_TIME_SECONDS, formatClock } from "@/lib/exam-time";
import { fillText, localeFor, pluralText } from "@/lib/dates";
import type { Dict } from "@/i18n/en";
import type { Lang } from "@/i18n";

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

// Candidates may hide the countdown (it can raise anxiety). It always comes
// back, in amber, when five minutes remain, with one announcement for screen
// readers. The deadline and the automatic submit are not affected.
const TIMER_HIDDEN_KEY = "vantage-timer-hidden";

function draftKey(caId: string) {
  return `aiac-exam-${caId}`;
}

// CAN-B-33: opening the same exam in a second tab (the invite link clicked
// twice, or reopened from history) used to make each tab silently clobber
// the other's localStorage draft on every keystroke, since each kept its own
// in-memory copy and wrote the whole thing out on every change. Rather than
// try to merge two independently-typed answers to the same question, only
// the most recently opened tab stays active; any earlier tab locks its
// inputs and points back to the active one. Self-healing: if the active tab
// closes, the remaining tab(s) re-announce and the newest survivor takes
// over. No BroadcastChannel support (very old browsers) just means no
// cross-tab lock -- the pre-existing behaviour, not a regression.
export function useSingleActiveTab(caId: string): boolean {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const tabId = Math.random().toString(36).slice(2);
    const openedAt = Date.now();
    const channel = new BroadcastChannel(`aiac-exam-lock-${caId}`);
    const isNewer = (otherOpenedAt: number, otherTabId: string) =>
      otherOpenedAt > openedAt || (otherOpenedAt === openedAt && otherTabId > tabId);
    let awaitingRecheck = false;
    let recheckTimer: ReturnType<typeof setTimeout> | null = null;

    const announce = (type: "hello" | "here") => channel.postMessage({ type, tabId, openedAt });

    channel.onmessage = (e) => {
      const msg = e.data as { type: "hello" | "here" | "bye"; tabId: string; openedAt: number } | undefined;
      if (!msg || msg.tabId === tabId) return;
      if (msg.type === "hello") {
        if (isNewer(msg.openedAt, msg.tabId)) {
          setLocked(true);
          awaitingRecheck = false;
        }
        announce("here");
      } else if (msg.type === "here") {
        if (isNewer(msg.openedAt, msg.tabId)) {
          setLocked(true);
          awaitingRecheck = false;
        }
      } else if (msg.type === "bye") {
        // The tab we may have deferred to just closed. Re-announce and give
        // any other still-open tab a moment to claim leadership before
        // unlocking -- a reply during that window cancels the unlock.
        if (recheckTimer) clearTimeout(recheckTimer);
        awaitingRecheck = true;
        announce("hello");
        recheckTimer = setTimeout(() => {
          if (awaitingRecheck) setLocked(false);
          awaitingRecheck = false;
        }, 250);
      }
    };

    announce("hello");
    const onUnload = () => channel.postMessage({ type: "bye", tabId, openedAt });
    window.addEventListener("pagehide", onUnload);
    return () => {
      if (recheckTimer) clearTimeout(recheckTimer);
      window.removeEventListener("pagehide", onUnload);
      onUnload();
      channel.close();
    };
  }, [caId]);
  return locked;
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
  deadlineMs: initialDeadlineMs,
  sections,
  submitAction,
  saveDraftAction,
  serverNowMs,
  serverDraft,
  watermarkLabel = "confidential",
  contentLanguage,
  lang,
  text,
}: {
  caId: string;
  // The server's clock when the page was sent, so a wrong device clock cannot
  // change how much time is left (E-04).
  serverNowMs?: number;
  // Answers saved on the server (E-05). Used when this device has none.
  serverDraft?: Record<string, string> | null;
  saveDraftAction?: (answers: Record<string, string>) => Promise<boolean>;
  title: string;
  description: string;
  deadlineMs: number;
  sections: RunnerSection[];
  submitAction: (formData: FormData) => Promise<void | { error: string }>;
  watermarkLabel?: string;
  totalQuestions: number;
  // The exam chrome follows the candidate's language; prompts and options are generated in the
  // assessment's own language (assessments.content_language). Marking them
  // with lang lets a screen reader switch voice for that text only (WCAG 3.1.2).
  contentLanguage?: string | null;
  // The candidate's language for the screen's own words (not the questions).
  lang: Lang;
  text: Dict["candidate"]["exam"];
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
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [timerHidden, setTimerHidden] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  // Null until mounted, so the server and first client render agree and the
  // countdown never shows a stale value during hydration.
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const submittedRef = useRef(false);
  // A failed submit keeps every answer on this device and offers a retry.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const answers = draft.answers;
  const flaggedSet = useMemo(() => new Set(draft.flagged), [draft.flagged]);
  const tabLocked = useSingleActiveTab(caId);
  const tabLockedRef = useRef(tabLocked);
  useEffect(() => {
    tabLockedRef.current = tabLocked;
  }, [tabLocked]);

  /* Restore the local draft once on mount, then keep it saved on this device. */
  useEffect(() => {
    const local = readDraft(caId);
    const hasLocal = Object.values(local.answers).some((v) => v && v.length > 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage after mount
    setDraft(!hasLocal && serverDraft ? { answers: serverDraft, flagged: local.flagged } : local);
    setRestored(true);
  }, [caId, serverDraft]);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of the timer preference
      setTimerHidden(localStorage.getItem(TIMER_HIDDEN_KEY) === "1");
    } catch {}
  }, []);
  const toggleTimer = useCallback(() => {
    setTimerHidden((h) => {
      try {
        localStorage.setItem(TIMER_HIDDEN_KEY, h ? "0" : "1");
      } catch {}
      return !h;
    });
  }, []);

  useEffect(() => {
    // A locked (non-active) tab never writes: its in-memory draft is stale
    // the moment another tab becomes active, and writing it out would wipe
    // out whatever the active tab has since saved (CAN-B-33).
    if (!restored || tabLocked) return;
    try {
      localStorage.setItem(draftKey(caId), JSON.stringify(draft));
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stamps the save time after each change
    setSavedAt(Date.now());
  }, [draft, restored, caId, tabLocked]);

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
  // Difference between the server clock and this device's clock.
  const clockOffsetRef = useRef(0);
  useEffect(() => {
    if (typeof serverNowMs === "number") clockOffsetRef.current = serverNowMs - Date.now();
  }, [serverNowMs]);

  // Save the answers on the server a few seconds after the last change, and
  // whenever the tab is hidden, so nothing depends on this device surviving.
  const lastSavedRef = useRef("");
  useEffect(() => {
    // Same reason as the localStorage write above: a locked tab's answers
    // are stale and must never reach the server over the active tab's.
    if (!restored || !saveDraftAction || tabLocked) return;
    const save = () => {
      const snapshot = JSON.stringify(answersRef.current);
      if (snapshot === lastSavedRef.current || submittedRef.current) return;
      lastSavedRef.current = snapshot;
      saveDraftAction(answersRef.current).then((ok) => {
        if (!ok) lastSavedRef.current = "";
      });
    };
    const timer = setTimeout(save, 4000);
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [answers, restored, saveDraftAction, tabLocked]);
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
      // A locked (non-active) tab's answers are stale by definition -- leave
      // the submit, including the automatic one at expiry, to whichever tab
      // is active. If that tab has since closed, this one takes over the
      // lock within moments (see useSingleActiveTab) and resumes being
      // eligible on the next tick.
      if (tabLockedRef.current) return;
      submittedRef.current = true;
      const fd = new FormData();
      for (const s of steps) fd.set(`q_${s.q.id}`, answersRef.current[s.q.id] || "");
      fd.set("tab_switch_count", String(tabSwitchesRef.current));
      fd.set("submit_reason", reason);
      setSubmitError(null);
      // The draft stays on this device until the server confirms. The
      // confirmation page clears it (see ClearDraft).
      startTransition(async () => {
        try {
          const res = await submitAction(fd);
          if (res && "error" in res) {
            submittedRef.current = false;
            // The server's message is always a generic "try again"; show it in the candidate's language.
            setSubmitError(text.submitFailed);
          }
        } catch (e) {
          // A redirect to the confirmation page is not a failure.
          if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
          submittedRef.current = false;
          setSubmitError(text.submitFailed);
        }
      });
    },
    [steps, submitAction, text.submitFailed]
  );

  /* Countdown: the single timer on screen, and the single source of truth for
     what happens at zero (an automatic submit). */
  // Extra time granted while the test is open: ask the server once a minute and
  // only ever move the end later (CAN-B-09).
  const [deadlineMs, setDeadlineMs] = useState(initialDeadlineMs);
  useEffect(() => {
    if (!restored) return;
    const poll = window.setInterval(() => {
      getExamDeadline(caId)
        .then((d) => {
          if (typeof d === "number") setDeadlineMs((cur) => (d > cur ? d : cur));
        })
        .catch(() => {});
    }, 60_000);
    return () => window.clearInterval(poll);
  }, [caId, restored]);

  // Waits for the draft to be restored: an assessment reopened after its
  // deadline must submit the answers already saved, never an empty paper.
  useEffect(() => {
    if (!restored) return;
    const tick = () => {
      const n = Date.now() + clockOffsetRef.current;
      setNowMs(n);
      if (Math.round((deadlineMs - n) / 1000) <= 0) doSubmit("expiry");
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadlineMs, doSubmit, restored]);

  const secondsLeft = nowMs === null ? null : Math.max(0, Math.round((deadlineMs - nowMs) / 1000));
  const low = secondsLeft !== null && secondsLeft < LOW_TIME_SECONDS;
  const timeLabel = secondsLeft === null ? "--:--" : formatClock(secondsLeft);
  // Hidden only while there is plenty of time; low time always shows it.
  const timerShown = !timerHidden || low;

  const answered = steps.filter((s) => (answers[s.q.id] || "").trim().length > 0).length;
  const flaggedCount = steps.filter((s) => flaggedSet.has(s.q.id)).length;
  const current = steps[idx];
  const set = useCallback(
    (qid: string, val: string) => {
      if (tabLocked) return;
      setDraft((d) => ({ ...d, answers: { ...d.answers, [qid]: val } }));
    },
    [tabLocked]
  );
  const toggleFlag = useCallback(
    (qid: string) => {
      if (tabLocked) return;
      setDraft((d) => ({
        ...d,
        flagged: d.flagged.includes(qid) ? d.flagged.filter((x) => x !== qid) : [...d.flagged, qid],
      }));
    },
    [tabLocked]
  );

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
      // Leave browser shortcuts alone (Ctrl/Cmd+F, Alt+Left...) and let a
      // focused button, link or menu keep its own Enter / arrow behaviour.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const onControl =
        target instanceof HTMLButtonElement ||
        target instanceof HTMLAnchorElement ||
        target instanceof HTMLSelectElement ||
        target?.getAttribute?.("role") === "button";
      if (onControl && (e.key === "Enter" || e.key === " ")) return;

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
      ? text.saved
      : // Minute steps only, so a screen reader is not interrupted every second.
        nowMs - savedAt < 60_000
        ? text.savedJustNow
        : fillText(text.savedMinAgo, { n: Math.floor((nowMs - savedAt) / 60_000) });

  // "Question 3, answered, flagged" for screen readers, in the candidate's language.
  const questionAria = (n: number, isAnswered: boolean, isFlagged: boolean) =>
    [fillText(text.questionAria, { n }), isAnswered ? text.answeredAria : text.notAnsweredAria, ...(isFlagged ? [text.flaggedAria] : [])].join(", ");
  const backLabel = text.backToTests;

  if (total === 0) {
    return (
      <div className="mx-auto max-w-[680px] p-6 pt-16 text-center">
        <p className="text-base text-muted">{text.noQuestions}</p>
        <Link href="/candidate/assessments" className="mt-6 inline-block text-sm font-semibold text-accent-dark hover:underline">
          {backLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="exam-canvas no-copy min-h-dvh bg-background text-foreground">
      <div className="watermark-overlay" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="row">
            {watermarkLabel} · {new Date().toLocaleDateString(localeFor(lang))} · {caId.slice(0, 8)}
          </div>
        ))}
      </div>

      {tabLocked ? (
        <div role="alert" className="sticky top-0 z-40 border-b border-warning/40 bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
          <span className="font-semibold">{text.openInOtherTabTitle}.</span> {text.openInOtherTab}
        </div>
      ) : null}

      {submitError ? (
        <div role="alert" className="sticky top-0 z-40 border-b border-warning/40 bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
          {submitError}{" "}
          <button type="button" className="font-semibold underline" onClick={() => doSubmit("manual")}>
            {text.tryAgain}
          </button>
        </div>
      ) : null}

      {/* One header: title, autosave status, the progress chain and the one timer. */}
      <header className="sticky top-0 z-30 border-b border-line bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1040px] items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold text-foreground sm:text-base">{title}</h1>
            <p className="truncate text-xs text-muted" aria-hidden="true">
              {savedLabel}
            </p>
            {/* Screen readers hear one fixed sentence, not a clock that changes every second. */}
            <p className="sr-only" role="status">
              {savedAt !== null ? text.savedSr : ""}
            </p>
          </div>
          {timerShown ? (
            <span
              className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-timer ring-1 ring-inset ${
                // Amber under five minutes, never red: running low is not a failure,
                // and the countdown always submits safely at zero.
                low ? "bg-warning-soft text-warning ring-warning/40" : "bg-surface text-foreground ring-line"
              }`}
            >
              <Icon name="timer" className="h-4 w-4" />
              <span aria-label={secondsLeft === null ? undefined : pluralText(lang, Math.ceil(secondsLeft / 60), text.minutesLeft).replace(/\.$/, "")}>{timeLabel}</span>
            </span>
          ) : null}
          {!low && (
            <button
              type="button"
              onClick={toggleTimer}
              aria-pressed={timerHidden}
              className="press shrink-0 inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Icon name={timerHidden ? "eye" : "eyeOff"} className="h-4 w-4" />
              {timerHidden ? text.showTimer : text.hideTimer}
            </button>
          )}
          {/* The text changes once a minute, so it is announced once a minute. */}
          <p className="sr-only" role="status">
            {secondsLeft === null ? "" : secondsLeft <= 60 ? text.lessThanMinute : pluralText(lang, Math.ceil(secondsLeft / 60), text.minutesLeft)}
          </p>
          <Link
            href="/candidate/assessments"
            className="shrink-0 rounded-xl px-3 py-2.5 text-sm font-semibold text-accent-dark hover:bg-accent-soft"
          >
            {text.saveExit}
          </Link>
        </div>

        <div className="mx-auto max-w-[1040px] px-4 pb-3 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <ProgressHorizon
              total={total}
              answered={answered}
              current={reviewing ? total - 1 : idx}
              label={fillText(text.progress, { current: (reviewing ? total - 1 : idx) + 1, total, answered })}
              answeredFlags={steps.map((s) => (answers[s.q.id] || "").trim().length > 0)}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={() => setShowGrid((g) => !g)}
              aria-expanded={showGrid}
              aria-controls="question-grid"
              className="press shrink-0 inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {text.allQuestions}
              <Icon name={showGrid ? "chevronUp" : "chevronDown"} className="h-4 w-4" />
            </button>
          </div>
          {showGrid && (
            <nav id="question-grid" aria-label={text.questionsNav} className="mt-2">
              <ol className="grid grid-cols-8 gap-1.5 sm:grid-cols-12">
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
                          setShowGrid(false);
                        }}
                        aria-label={questionAria(i + 1, isAnswered, isFlagged)}
                        aria-current={isCurrent ? "step" : undefined}
                        className={`relative grid min-h-11 w-full place-items-center rounded-md text-sm font-semibold tabular-nums ${
                          isAnswered ? "bg-brand text-on-primary" : "bg-surface text-foreground ring-1 ring-inset ring-line-control"
                        } ${isCurrent ? "outline-2 outline-offset-2 outline-focus" : ""}`}
                      >
                        {i + 1}
                        {isFlagged && <span aria-hidden className="absolute right-1 top-1 h-2 w-2 rounded-full bg-warning" />}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}
        </div>
      </header>

      {reviewing ? (
        /* ---------- Review: every question on one grid, then one submit ---------- */
        <main className="mx-auto max-w-[680px] px-5 pb-16 pt-10 sm:pt-14">
          <h2 className="text-2xl font-bold text-foreground">{text.reviewTitle}</h2>
          <p className="mt-2 text-base text-muted">
            {fillText(flaggedCount > 0 ? text.reviewSummaryFlagged : text.reviewSummary, { answered, total, flagged: flaggedCount })} {text.reviewHint}
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
                    aria-label={questionAria(i + 1, isAnswered, isFlagged)}
                    className={`relative grid h-11 w-full place-items-center rounded-xl text-sm font-bold tabular-nums transition-colors ${
                      isAnswered
                        ? "bg-brand text-on-primary"
                        : "bg-surface text-foreground ring-1 ring-inset ring-line-control hover:bg-surface-sunken"
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
              <span className="h-3.5 w-3.5 rounded-md bg-brand" /> {text.legendAnswered}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-md ring-1 ring-inset ring-line-strong" /> {text.legendNotAnswered}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-warning" /> {text.legendFlagged}
            </span>
          </p>

          {answered < total && (
            <p role="status" className="mt-6 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
              {pluralText(lang, total - answered, text.unanswered)}
            </p>
          )}
          {confirmingSubmit && (
            <div role="alertdialog" aria-labelledby="confirm-submit-h" className="mt-6 rounded-card border border-line bg-surface p-5">
              <h3 id="confirm-submit-h" className="text-lg font-semibold text-foreground">
                {text.confirmTitle}
              </h3>
              <p className="mt-1 text-base text-muted">{text.confirmBody}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" autoFocus onClick={() => doSubmit()} disabled={isPending || tabLocked} className={buttonClass({ size: "md" })}>
                  {isPending ? text.submitting : text.yesSubmit}
                </button>
                <button type="button" onClick={() => setConfirmingSubmit(false)} className={buttonClass({ size: "md", variant: "secondary" })}>
                  {text.keepEditing}
                </button>
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setReviewing(false)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line px-5 text-sm font-semibold text-foreground transition-colors hover:border-brand"
            >
              <Icon name="arrowLeft" className="h-4 w-4" />
              {text.keepEditing}
            </button>
            <div className="flex-1">
              <button
                type="button"
                onClick={() => setConfirmingSubmit(true)}
                disabled={isPending || tabLocked}
                className={buttonClass({ size: "lg", block: true })}
              >
                <Icon name="send" className="h-4 w-4" />
                {isPending ? text.submitting : answered < total ? text.submitWithUnanswered : text.submitAnswers}
              </button>
            </div>
          </div>
        </main>
      ) : (
        /* ---------- One question at a time, at reading width ---------- */
        <main className="mx-auto max-w-[680px] px-5 pb-16 pt-8 sm:pt-12">
          {tabSwitches > 0 && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-soft px-4 py-2.5 text-sm font-medium text-warning">
              <Icon name="eye" className="h-4 w-4 shrink-0" />
              {pluralText(lang, tabSwitches, text.tabLeft)} {text.tabLogged}
            </div>
          )}

          <div key={current.q.id} className="anim-fade-in">
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold tabular-nums text-muted">
                {fillText(text.questionOf, { n: idx + 1, total })}
                <span className="mx-2 text-line-strong" aria-hidden>
                  ·
                </span>
                <span className="font-medium">{current.sectionTitle}</span>
              </p>
              <button
                type="button"
                onClick={() => toggleFlag(current.q.id)}
                disabled={tabLocked}
                aria-pressed={flaggedSet.has(current.q.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  flaggedSet.has(current.q.id)
                    ? "bg-warning-soft text-warning ring-warning/50"
                    : "text-muted ring-line hover:text-foreground hover:ring-line-strong"
                }`}
              >
                <Icon name="flag" className="h-4 w-4" />
                {flaggedSet.has(current.q.id) ? text.flagged : text.flag}
              </button>
            </div>

            <h2 className="mb-8 text-xl font-semibold leading-relaxed text-foreground" {...contentLangAttr}>
              {current.q.prompt}
            </h2>

            {current.q.type === "mcq" ? (
              <div className="space-y-3" role="radiogroup" aria-label={fillText(text.optionsAria, { n: idx + 1 })}>
                {current.q.options.map((opt) => {
                  const selected = answers[current.q.id] === opt.key;
                  return (
                    <label
                      key={opt.key}
                      className={`flex min-h-16 items-center gap-4 rounded-card border px-4 py-3.5 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-accent ${
                        tabLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                      } ${selected ? "border-brand bg-accent-soft ring-1 ring-brand" : "border-line bg-surface hover:border-line-strong"}`}
                    >
                      <input
                        type="radio"
                        name={`q_${current.q.id}`}
                        value={opt.key}
                        checked={selected}
                        disabled={tabLocked}
                        onChange={() => set(current.q.id, opt.key)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                          selected ? "bg-brand text-on-primary" : "bg-background text-foreground ring-1 ring-inset ring-line"
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
                  {text.yourAnswer}
                </label>
                <textarea
                  id={`answer-${current.q.id}`}
                  value={answers[current.q.id] || ""}
                  onChange={(e) => set(current.q.id, e.target.value)}
                  disabled={tabLocked}
                  rows={9}
                  placeholder={text.placeholder}
                  className="w-full resize-y rounded-card border border-line bg-surface px-4 py-3.5 text-base leading-relaxed text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="mt-2 text-sm tabular-nums text-muted">
                  {pluralText(lang, (answers[current.q.id] || "").trim().split(/\s+/).filter(Boolean).length, text.words)} {text.aim}
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
              {text.previous}
            </button>

            {idx < total - 1 ? (
              <button
                type="button"
                onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
                className="inline-flex min-h-12 items-center gap-2 rounded-md bg-brand px-6 text-sm font-semibold text-on-primary transition-colors hover:bg-brand-hover"
              >
                {text.next}
                <Icon name="arrowRight" className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setReviewing(true)}
                className="inline-flex min-h-12 items-center gap-2 rounded-md bg-brand px-6 text-sm font-semibold text-on-primary transition-colors hover:bg-brand-hover"
              >
                {text.reviewAnswers}
                <Icon name="checkCircle" className="h-4 w-4" />
              </button>
            )}
          </div>

          <p className="mt-8 flex items-center gap-2 text-sm text-muted">
            <Icon name="keyboard" className="h-4 w-4 shrink-0" />
            {current.q.type === "mcq"
              ? text.hintMcq
              : text.hintText}
          </p>
        </main>
      )}
    </div>
  );
}
