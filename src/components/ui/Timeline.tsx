import { Icon } from "@/components/ui/Icon";
import type { ReactNode } from "react";

export type TimelineStep = { label: ReactNode; detail?: ReactNode; state: "done" | "current" | "todo" };

// A vertical timeline: a hairline with a node per step. State is shown by
// shape and text as well as colour (check, ring, empty).
export function Timeline({ steps, className = "" }: { steps: TimelineStep[]; className?: string }) {
  return (
    <ol className={`space-y-0 ${className}`}>
      {steps.map((s, i) => (
        <li key={i} className="relative flex gap-4 pb-6 last:pb-0" aria-current={s.state === "current" ? "step" : undefined}>
          {i < steps.length - 1 && <span aria-hidden className={`absolute left-[11px] top-6 bottom-0 w-px ${s.state === "done" ? "bg-good" : "bg-line"}`} />}
          <span
            aria-hidden
            className={`relative z-10 mt-0.5 w-6 h-6 rounded-full grid place-items-center shrink-0 ${
              s.state === "done"
                ? "bg-good text-on-good"
                : s.state === "current"
                  ? "bg-surface ring-2 ring-accent"
                  : "bg-surface ring-1 ring-line-control"
            }`}
          >
            {s.state === "done" ? <Icon name="check" className="w-3.5 h-3.5" /> : s.state === "current" ? <span className="w-2 h-2 rounded-full bg-accent" /> : null}
          </span>
          <div className="min-w-0">
            <p className={`text-base font-semibold ${s.state === "todo" ? "text-muted" : "text-foreground"}`}>{s.label}</p>
            {s.detail && <p className="text-sm text-muted mt-0.5">{s.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
