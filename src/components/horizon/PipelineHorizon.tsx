import Link from "next/link";

export type PipelineStage = { key: string; label: string; count: number; href?: string; emphasis?: boolean };

// The staff home's pipeline (Clear Horizon plan, section 10): candidates laid
// out left to right along one horizon line, one node and one number per stage.
// The stage that needs a person (ready for review) is emphasised. Every stage
// is a real list item with its own text, and a one-line summary is provided for
// screen readers, so nothing depends on seeing the line.
export function PipelineHorizon({ stages, overdue = 0, className = "" }: { stages: PipelineStage[]; overdue?: number; className?: string }) {
  const summary =
    stages.map((s) => `${s.count} ${s.label.toLowerCase()}`).join(", ") + (overdue > 0 ? `. ${overdue} overdue.` : ".");
  return (
    <div className={className}>
      <p className="sr-only">{summary}</p>
      <ol className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-6">
        {stages.map((s) => {
          const body = (
            <>
              <span
                aria-hidden
                className={`hidden sm:block relative h-px mb-4 ${s.emphasis ? "bg-accent" : "bg-line-control"}`}
              >
                <span
                  className={`absolute -top-[5px] left-0 w-[11px] h-[11px] rounded-full ${
                    s.emphasis ? "bg-accent ring-4 ring-accent-soft" : "bg-surface ring-2 ring-line-control"
                  }`}
                />
              </span>
              <span className={`block text-display tabular-nums ${s.emphasis ? "text-accent" : "text-foreground"}`}>{s.count}</span>
              <span className="block mt-1 text-sm font-semibold text-foreground">{s.label}</span>
            </>
          );
          return (
            <li key={s.key}>
              {s.href ? (
                <Link href={s.href} className="press block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus hover:opacity-80">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>
      {overdue > 0 && (
        <p className="mt-5 text-sm font-semibold text-warning">
          {overdue === 1 ? "1 invitation is past its due date." : `${overdue} invitations are past their due date.`}
        </p>
      )}
    </div>
  );
}
