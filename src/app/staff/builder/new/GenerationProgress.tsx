"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LEVELS, type LevelKey } from "@/lib/levels";
import type { Job, PositionSel } from "./types";

type Combo = { key: string; posKey: string; level: LevelKey };

export function GenerationProgress({
  combos,
  positions,
  jobs,
  running,
  onRetry,
}: {
  combos: Combo[];
  positions: PositionSel[];
  jobs: Record<string, Job>;
  running: boolean;
  onRetry: (key: string) => void;
}) {
  // A ticking clock for the elapsed-time labels. It only runs while a draft is
  // in progress, and it is kept in state so rendering never reads Date.now().
  const anyRunning = Object.values(jobs).some((j) => j.status === "running");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  if (combos.length === 0 || Object.keys(jobs).length === 0) return null;

  const titleFor = (posKey: string) => positions.find((p) => p.key === posKey)?.title ?? "Position";

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 space-y-4" aria-live="polite">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold text-foreground">Drafts</h2>
        <span className="text-2xs font-semibold text-muted">{running ? "Working…" : "Finished"}</span>
      </header>

      <ul className="divide-y divide-line">
        {combos.map((c) => {
          const job = jobs[c.key];
          if (!job) return null;
          const label = `${titleFor(c.posKey)} — ${LEVELS[c.level].label}`;
          const elapsed = job.startedAt ? Math.max(0, Math.round((now - job.startedAt) / 1000)) : 0;

          return (
            <li key={c.key} className="py-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{label}</p>
                <StatusLine job={job} elapsed={elapsed} />
                {job.warnings.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {job.warnings.map((w, i) => (
                      <li key={i} className="text-2xs text-warning bg-amber-50 rounded-md px-2 py-1">
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
                {job.error && <p className="mt-2 text-xs text-critical">{job.error}</p>}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {job.status === "done" && job.assessmentId && (
                  <Link href={`/staff/builder/${job.assessmentId}`} className="text-xs font-semibold text-accent-dark hover:underline">
                    Review draft
                  </Link>
                )}
                {job.status === "failed" && !running && (
                  <button
                    type="button"
                    onClick={() => onRetry(c.key)}
                    className="text-xs font-semibold border border-line rounded-lg px-3 py-1.5 hover:border-accent"
                  >
                    Retry this one
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StatusLine({ job, elapsed }: { job: Job; elapsed: number }) {
  if (job.status === "queued") return <p className="text-xs text-muted mt-0.5">Waiting to start</p>;
  if (job.status === "running") {
    return (
      <p className="text-xs text-muted mt-0.5 inline-flex items-center gap-2">
        <span className="w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden />
        {job.empty ? "Creating empty draft" : "Generating"} · {elapsed}s{job.attempt > 1 ? ` · attempt ${job.attempt}` : ""}
      </p>
    );
  }
  if (job.status === "done") {
    return <p className="text-xs text-emerald-700 mt-0.5">{job.empty ? "Empty draft created" : "Draft ready"} · not visible to candidates until published</p>;
  }
  return <p className="text-xs text-critical mt-0.5">Didn&apos;t finish</p>;
}
