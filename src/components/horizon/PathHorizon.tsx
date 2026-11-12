export type PathStep = { label: string; state: "done" | "current" | "todo" };

// The candidate's path (Clear Horizon plan, section 11): five nodes on a line,
// done / current / still to come. On a phone only the current step's name is
// shown, as a sentence, because five labels will not fit at a readable size.
export function PathHorizon({ steps, className = "" }: { steps: PathStep[]; className?: string }) {
  const currentIdx = Math.max(0, steps.findIndex((s) => s.state === "current"));
  const current = steps[currentIdx];
  return (
    <div className={className}>
      <ol className="flex items-start">
        {steps.map((s, i) => (
          <li key={s.label} aria-current={s.state === "current" ? "step" : undefined} className="relative flex-1 min-w-0">
            {i > 0 && <span aria-hidden className={`absolute top-[9px] right-1/2 w-full h-0.5 ${s.state === "todo" ? "bg-line" : "bg-good"}`} />}
            <span
              aria-hidden
              className={`relative z-10 mx-auto w-5 h-5 rounded-full grid place-items-center ${
                s.state === "done" ? "bg-good" : s.state === "current" ? "bg-surface ring-2 ring-accent" : "bg-surface ring-1 ring-line-control"
              }`}
            >
              {s.state === "current" && <span className="w-2 h-2 rounded-full bg-accent" />}
              {s.state === "done" && <span className="w-1.5 h-1.5 rounded-full bg-on-good" />}
            </span>
            <span className={`hidden sm:block mt-2 px-1 text-center text-sm ${s.state === "current" ? "font-semibold text-foreground" : s.state === "done" ? "text-foreground" : "text-muted"}`}>
              {s.label}
              <span className="sr-only">{s.state === "done" ? " (done)" : s.state === "current" ? " (current step)" : " (still to come)"}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="sm:hidden mt-3 text-sm text-muted">
        Step {currentIdx + 1} of {steps.length}: <span className="font-semibold text-foreground">{current?.label}</span>
      </p>
    </div>
  );
}
