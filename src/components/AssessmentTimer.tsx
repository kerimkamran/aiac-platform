"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";

export function AssessmentTimer({
  deadlineMs: deadlineParam,
  totalQuestions,
  onExpire,
}: {
  deadlineMs: number;
  totalQuestions: number;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isLow, setIsLow] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, deadlineParam - now);
      setRemaining(diff);
      setIsLow(diff < 5 * 60 * 1000); // 5 minutes

      if (diff <= 0) {
        onExpire();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadlineParam, onExpire]);

  if (remaining === null) return null;

  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  const paceMinPerQ = 2;
  const expectedMs = totalQuestions * paceMinPerQ * 60_000;
  const progressPct = Math.min(100, ((expectedMs - remaining) / expectedMs) * 100);

  return (
    <div className={`sticky top-0 z-40 border-b ${isLow ? "border-red-300 bg-red-50" : "border-line bg-white"} px-6 py-3`}>
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon name={isLow ? "alertTriangle" : "timer"} className={`w-4 h-4 ${isLow ? "text-red-600" : "text-muted"}`} />
          <div>
            <p className={`text-sm font-bold tabular-nums ${isLow ? "text-red-600" : "text-foreground"}`}>
              {mins}:{secs.toString().padStart(2, "0")} remaining
            </p>
            <p className="text-xs text-faint">
              {totalQuestions} questions × {paceMinPerQ} min = {Math.ceil(totalQuestions * paceMinPerQ)} min suggested
            </p>
          </div>
        </div>
        {isLow && <p className="text-xs font-semibold text-red-600">Time running out</p>}
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 bg-line rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${isLow ? "bg-red-500" : "bg-brand"}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
