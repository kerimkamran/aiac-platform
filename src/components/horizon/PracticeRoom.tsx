"use client";

import { useState } from "react";
import { ProgressHorizon } from "@/components/horizon/ProgressHorizon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

// The practice room (Clear Horizon plan, section 12): the real exam layout with
// sample questions, no timer, nothing scored and nothing saved. Answers live in
// this component's state only and disappear when the page is closed.
const QUESTIONS = [
  {
    type: "mcq" as const,
    prompt:
      "You are leading a project that is on track, when a senior colleague from another department asks you to urgently take over a task that would put your own deadline at risk. What would you most likely do?",
    options: [
      { key: "A", text: "Accept immediately. Helping a senior colleague matters more than my own deadline." },
      { key: "B", text: "Decline. My project commitments come first and the request isn't my responsibility." },
      { key: "C", text: "Explore the urgency with them, then agree what I can realistically take on and align with my manager on the trade-off." },
      { key: "D", text: "Accept, but quietly deprioritise it and hope the deadline pressure resolves itself." },
    ],
  },
  {
    type: "text" as const,
    prompt: "Describe a time you had to explain a difficult decision to someone who disagreed with it. What did you do, and what happened?",
    options: [],
  },
];

export function PracticeRoom({ backHref }: { backHref: string }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const q = QUESTIONS[idx];
  const answered = QUESTIONS.filter((_, i) => (answers[i] || "").trim().length > 0).length;
  const last = idx === QUESTIONS.length - 1;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-line bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1040px] items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">Practice room</h1>
            <p className="truncate text-sm text-muted">No timer. Not scored. Not recorded.</p>
          </div>
          <ButtonLink href={backHref} variant="ghost">
            Back
          </ButtonLink>
        </div>
        <div className="mx-auto max-w-[1040px] px-4 pb-3 sm:px-6">
          <ProgressHorizon total={QUESTIONS.length} answered={answered} current={idx} />
        </div>
      </header>

      <main className="mx-auto max-w-[680px] px-5 pb-16 pt-8 sm:pt-12">
        <h2 className="mb-8 text-title-large leading-relaxed text-foreground">{q.prompt}</h2>
        {q.type === "mcq" ? (
          <div className="space-y-3" role="radiogroup" aria-label="Answer options">
            {q.options.map((o) => {
              const selected = answers[idx] === o.key;
              return (
                <label
                  key={o.key}
                  className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-card border px-4 py-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                    selected ? "border-accent bg-accent-soft" : "border-line-control bg-surface hover:bg-surface-sunken"
                  }`}
                >
                  <input type="radio" name="practice" value={o.key} checked={selected} onChange={() => setAnswers((a) => ({ ...a, [idx]: o.key }))} className="sr-only" />
                  <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${selected ? "bg-brand text-on-primary" : "bg-surface-sunken text-foreground"}`}>
                    {o.key}
                  </span>
                  <span className="text-base leading-snug">{o.text}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div>
            <label htmlFor="practice-text" className="sr-only">
              Your answer
            </label>
            <textarea
              id="practice-text"
              rows={8}
              value={answers[idx] || ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [idx]: e.target.value }))}
              placeholder="Describe a specific situation, the action you took, and the result…"
              className="w-full resize-y rounded-card border border-line-control bg-surface px-4 py-3.5 text-base leading-relaxed placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
            />
          </div>
        )}

        <div className="mt-10 flex items-center justify-between gap-3">
          <Button variant="secondary" size="lg" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
            <Icon name="arrowLeft" className="mr-2 h-4 w-4" />
            Previous
          </Button>
          {last ? (
            <ButtonLink href={backHref} size="lg">
              Finish practice
            </ButtonLink>
          ) : (
            <Button size="lg" onClick={() => setIdx((i) => i + 1)}>
              Next
              <Icon name="arrowRight" className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
