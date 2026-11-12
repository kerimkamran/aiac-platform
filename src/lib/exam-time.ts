// The exam deadline: started_at plus the assessment's time limit plus any extra
// minutes HR granted this candidate (migration 0018). Pure, so the page, the
// timer and the tests agree.
export const MAX_EXTRA_MINUTES = 240;

export function clampExtra(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(MAX_EXTRA_MINUTES, Math.max(0, Math.round(v)));
}

export function examDeadlineMs(startedAt: string | number | Date, limitMinutes: number | null | undefined, extraMinutes?: number | null): number {
  const limit = limitMinutes && limitMinutes > 0 ? limitMinutes : 60;
  return new Date(startedAt).getTime() + (limit + clampExtra(extraMinutes ?? 0)) * 60_000;
}

// The timer turns amber (never red) when this many seconds remain.
export const LOW_TIME_SECONDS = 300;

export function formatClock(secondsLeft: number): string {
  const s = Math.max(0, Math.round(secondsLeft));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
