import type { ReactNode } from "react";

// Status pill (Clear Horizon plan, section 16): a dot and text, never colour
// alone. BandLabel pairs a proficiency band with its score, so a bare number
// never stands on its own.
export type PillTone = "neutral" | "info" | "good" | "warning" | "critical";

const TONE: Record<PillTone, { box: string; dot: string }> = {
  neutral: { box: "bg-line-soft text-muted", dot: "bg-line-strong" },
  info: { box: "bg-accent-soft text-accent-dark", dot: "bg-accent" },
  good: { box: "bg-good-soft text-good", dot: "bg-good" },
  warning: { box: "bg-warning-soft text-warning", dot: "bg-warning" },
  critical: { box: "bg-critical-soft text-critical", dot: "bg-critical" },
};

export function StatusPill({ tone = "neutral", children, className = "" }: { tone?: PillTone; children: ReactNode; className?: string }) {
  const t = TONE[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-sm whitespace-nowrap ${t.box} ${className}`}>
      <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
      {children}
    </span>
  );
}

export type BandInfo = { label: string; tone: PillTone };

// Bands follow the scoring rubric: 85+ Exceeds, 70+ Fully meets, 50+ Partially
// meets, below that Does not meet. (Sentence case, per the type rules.)
export function bandInfo(score: number): BandInfo {
  if (score >= 85) return { label: "Exceeds", tone: "good" };
  if (score >= 70) return { label: "Fully meets", tone: "info" };
  if (score >= 50) return { label: "Partially meets", tone: "warning" };
  return { label: "Does not meet", tone: "critical" };
}

export function BandLabel({ score, className = "" }: { score: number; className?: string }) {
  const b = bandInfo(score);
  return (
    <StatusPill tone={b.tone} className={className}>
      {b.label}
      <span aria-hidden className="opacity-60">
        ·
      </span>
      <span className="tabular-nums">{score}</span>
    </StatusPill>
  );
}
