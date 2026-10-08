"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";

// Purely presentational: this component only renders a countdown display.
// It used to also own an expiry side effect (calling an onExpire callback
// from inside this effect), but that made it a second, independent expiry
// trigger racing the assessment runner's own countdown (which already
// auto-submits correctly) -- see the design-execution-plan Phase 0 / T0.1
// fix notes in runner.tsx for the full story. The runner is the only place
// that decides what happens at zero; this component just shows the number.
export function AssessmentTimer({
  deadlineMs: deadlineParam,
  totalQuestions,
}: {
  deadlineMs: number;
  totalQuestions: number;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isLow, setIsLow] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, deadlineParam - now);
      setRemaining(diff);
      setIsLow(diff < 5 * 60 * 1000); // 5 minutes
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadlineParam]);

  if (remaining === null) return null;

  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  const paceMinPerQ = 2;
  const expectedMs = totalQuestions * paceMinPerQ * 60_000;
  const progressPct = Math.min(100, ((expectedMs - remaining) / expectedMs) * 100);

  // Design-execution-plan Phase 4 / T4.5: this previously escalated straight
  // to alarm-red with no explanation of what happens at zero, which reads as
  // a threat ("time running out") rather than information -- worse for
  // anyone already anxious about a timed assessment, and not something a
  // countdown genuinely needs since T0.1 guarantees a safe auto-submit.
  // Recolored to the app's amber `warning` token (not `critical`/red, which
  // is reserved for actual failure states) and paired with what actually
  // happens next.
  return (
    <div className={`sticky top-0 z-40 border-b ${isLow ? "border-warning/30 bg-warning/10" : "border-line bg-surface"} px-6 py-3`}>
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon name={isLow ? "alertTriangle" : "timer"} className={`w-4 h-4 ${isLow ? "text-warning" : "text-muted"}`} />
          <div>
            <p className={`text-sm font-bold tabular-nums ${isLow ? "text-warning" : "text-foreground"}`}>
              {mins}:{secs.toString().padStart(2, "0")} remaining
            </p>
            <p className="text-xs text-muted">
              {totalQuestions} questions × {paceMinPerQ} min = {Math.ceil(totalQuestions * paceMinPerQ)} min suggested
            </p>
          </div>
        </div>
        {isLow && (
          <p className="text-xs font-medium text-warning text-right max-w-[220px]">
            Running low — your answers are already saved and the assessment submits automatically when time is up.
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 bg-line rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${isLow ? "bg-warning" : "bg-brand"}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
