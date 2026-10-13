import type { ReactNode } from "react";

// Status callout (plan v2, section 4.1): every status colour has a soft
// container and a text colour, and the text is always readable on it.
export type CalloutTone = "info" | "good" | "warning" | "critical";

const TONE: Record<CalloutTone, string> = {
  info: "bg-accent-soft text-on-primary-container",
  good: "bg-good-soft text-good",
  warning: "bg-warning-soft text-warning",
  critical: "bg-critical-soft text-critical",
};

export function Callout({ tone = "info", children, role }: { tone?: CalloutTone; children: ReactNode; role?: "alert" | "status" }) {
  return (
    <div role={role} className={`rounded-card px-4 py-3 text-sm ${TONE[tone]}`}>
      {children}
    </div>
  );
}
