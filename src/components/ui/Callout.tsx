import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

// Status callout (Clear Horizon plan, section 16): every status colour has a
// soft container and a text colour, an icon, and a heading when it helps. The
// meaning never depends on colour alone.
export type CalloutTone = "info" | "good" | "warning" | "critical";

const TONE: Record<CalloutTone, { box: string; icon: string }> = {
  info: { box: "bg-accent-soft text-on-primary-container", icon: "info" },
  good: { box: "bg-good-soft text-good", icon: "checkCircle" },
  warning: { box: "bg-warning-soft text-warning", icon: "alertTriangle" },
  critical: { box: "bg-critical-soft text-critical", icon: "alertTriangle" },
};

export function Callout({
  tone = "info",
  title,
  children,
  role,
  className = "",
}: {
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
  role?: "alert" | "status";
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div role={role} className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${t.box} ${className}`}>
      <Icon name={t.icon} className="w-5 h-5 shrink-0 mt-px" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}
