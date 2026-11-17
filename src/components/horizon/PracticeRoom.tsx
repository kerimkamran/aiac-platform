"use client";

import { useState } from "react";
import { ProgressHorizon } from "@/components/horizon/ProgressHorizon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Dict } from "@/i18n/en";

// The practice room (Clear Horizon plan, section 12): the real exam layout with
// sample questions, no timer, nothing scored and nothing saved. Answers live in
// this component's state only and disappear when the page is closed.
export function PracticeRoom({ backHref, text }: { backHref: string; text: Dict["candidate"]["practice"] }) {
  const QUESTIONS = [
    { type: "mcq" as const, prompt: text.mcqPrompt, options: text.mcqOptions.map((t, i) => ({ key: "ABCD"[i], text: t })) },
    { type: "text" as const, prompt: text.textPrompt, options: [] as { key: string; text: string }[] },
  ];
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
            <h1 className="truncate text-base font-semibold">{text.title}</h1>
            <p className="truncate text-sm text-muted">{text.subtitle}</p>
          </div>
          <ButtonLink href={backHref} variant="ghost">
            {text.back}
          </ButtonLink>
        </div>
        <div className="mx-auto max-w-[1040px] px-4 pb-3 sm:px-6">
          <ProgressHorizon total={QUESTIONS.length} answered={answered} current={idx} />
        </div>
      </header>

      <main className="mx-auto max-w-[680px] px-5 pb-16 pt-8 sm:pt-12">
        <h2 className="mb-8 text-title-large leading-relaxed text-foreground">{q.prompt}</h2>
        {q.type === "mcq" ? (
          <div className="space-y-3" role="radiogroup" aria-label={text.optionsAria}>
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
              {text.yourAnswer}
            </label>
            <textarea
              id="practice-text"
              rows={8}
              value={answers[idx] || ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [idx]: e.target.value }))}
              placeholder={text.placeholder}
              className="w-full resize-y rounded-card border border-line-control bg-surface px-4 py-3.5 text-base leading-relaxed placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
            />
          </div>
        )}

        <div className="mt-10 flex items-center justify-between gap-3">
          <Button variant="secondary" size="lg" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
            <Icon name="arrowLeft" className="mr-2 h-4 w-4" />
            {text.previous}
          </Button>
          {last ? (
            <ButtonLink href={backHref} size="lg">
              {text.finish}
            </ButtonLink>
          ) : (
            <Button size="lg" onClick={() => setIdx((i) => i + 1)}>
              {text.next}
              <Icon name="arrowRight" className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
