"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

/**
 * One untimed, unscored sample situational-judgment question shown on the
 * pre-start screen, so candidates see the format before the clock starts.
 * Standard practice at major assessment providers -- reduces anxiety-driven
 * noise in first-section scores. Nothing here is recorded anywhere.
 */
const PRACTICE = {
  prompt:
    "You are leading a project that is on track, when a senior colleague from another department asks you to urgently take over a task that would put your own deadline at risk. What would you most likely do?",
  options: [
    {
      key: "A",
      text: "Accept immediately — helping a senior colleague matters more than my own deadline.",
    },
    {
      key: "B",
      text: "Decline — my project commitments come first and the request isn't my responsibility.",
    },
    {
      key: "C",
      text: "Explore the urgency with them, then agree what I can realistically take on and align with my manager on the trade-off.",
    },
    {
      key: "D",
      text: "Accept, but quietly deprioritize it and hope the deadline pressure resolves itself.",
    },
  ],
};

export function PracticeQuestion() {
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="border border-dashed border-line rounded-xl p-5 bg-surface/50">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-faint mb-3">
        <Icon name="info" className="w-3.5 h-3.5" />
        Practice question — not scored, not recorded
      </p>
      <p className="text-sm text-foreground mb-4">{PRACTICE.prompt}</p>
      <div className="space-y-2">
        {PRACTICE.options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setPicked(o.key)}
            className={`w-full text-left flex items-start gap-3 border rounded-xl px-4 py-3 text-sm transition-colors ${
              picked === o.key
                ? "border-accent bg-accent-soft/40 text-foreground"
                : "border-line text-muted hover:border-faint"
            }`}
          >
            <span className="font-bold shrink-0">{o.key}</span>
            <span>{o.text}</span>
          </button>
        ))}
      </div>
      {picked && (
        <p className="text-xs text-muted mt-4 leading-relaxed">
          Thanks — that's exactly how the real questions work. There are no trick options: choose the response closest
          to what you would actually do. In the real assessment your answers are scored against this role's competency
          model, so answer honestly rather than trying to guess a "right" answer.
        </p>
      )}
    </div>
  );
}
