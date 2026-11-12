// Exam progress (Clear Horizon plan, section 12): a thin horizon with a node
// for each question. Answered nodes fill, the current one rings. It replaces
// numeric-only progress, and reads as text too ("Question 4 of 12, 3 answered").
export function ProgressHorizon({ total, answered, current, className = "" }: { total: number; answered: number; current: number; className?: string }) {
  const pct = total > 1 ? (current / (total - 1)) * 100 : 0;
  const dots = total <= 40;
  return (
    <div className={className}>
      <p className="text-sm text-muted">
        Question <span className="font-semibold text-foreground tabular-nums">{current + 1}</span> of {total} ·{" "}
        <span className="tabular-nums">{answered}</span> answered
      </p>
      <div aria-hidden className="relative mt-2 h-4">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-line" />
        <div className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 horizon-rule" style={{ width: `${pct}%`, height: 2 }} />
        {dots && (
          <div className="absolute inset-0 flex items-center justify-between">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`rounded-full ${i === current ? "w-3 h-3 bg-surface ring-2 ring-accent" : i < current ? "w-1.5 h-1.5 bg-accent" : "w-1.5 h-1.5 bg-line-control"}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
