import type { Dict } from "@/i18n/dictionaries";
import { Icon } from "@/components/ui/Icon";

// Fig. 01 on the landing page: a static, accessible copy of the exam screen
// (Clear Horizon plan, section 9). One question, the progress horizon, the
// saved indicator. It is a picture of the product, so nothing in it is
// interactive and the whole figure is described once for screen readers.
export function ExamPreview({ fig }: { fig: Dict["candidates"]["fig"] }) {
  return (
    <div role="img" aria-label={`${fig.progress}. ${fig.question}`} className="select-none">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">{fig.saved}</span>
        <span className="flex items-center gap-2 text-foreground">
          <Icon name="clock" className="w-4 h-4 text-muted" />
          <span className="text-muted">{fig.timeLeft}</span>
          <span className="text-timer text-foreground">38:12</span>
        </span>
      </div>
      <div aria-hidden className="relative mt-3 h-0.5 bg-line">
        <div className="absolute inset-y-0 left-0 w-1/3 horizon-rule" />
        <span className="absolute -top-[3px] left-1/3 -ml-1 w-2 h-2 rounded-full bg-accent" />
      </div>
      <p className="mt-2 text-sm text-muted">{fig.progress}</p>
      <p className="mt-5 text-title text-foreground">{fig.question}</p>
      <ul className="mt-4 space-y-2" aria-hidden>
        {fig.options.map((o, i) => (
          <li
            key={o}
            className={`flex items-start gap-3 rounded-md border px-3.5 py-3 text-base ${
              i === 0 ? "border-accent bg-accent-soft text-foreground" : "border-line-control text-foreground"
            }`}
          >
            <span
              className={`mt-1 w-4 h-4 shrink-0 rounded-full border-2 grid place-items-center ${i === 0 ? "border-accent" : "border-line-control"}`}
            >
              {i === 0 && <span className="w-2 h-2 rounded-full bg-accent" />}
            </span>
            {o}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm font-semibold text-accent">{fig.exit}</span>
        <span className="inline-flex min-h-10 items-center rounded-md bg-brand px-4 text-sm font-semibold text-on-primary">→</span>
      </div>
    </div>
  );
}
