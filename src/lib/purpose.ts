// Purpose-aware constants shared across the Builder, staff review pages,
// decision-maker review pages, and the candidate experience.
//
// assessments.purpose is a DB-level enum ('hiring' | 'promotion' | 'development',
// defaulting to 'hiring') that predates this file — this module is the single
// place that turns that value into UI language, decision options, and defaults,
// so every surface stays in sync as new purpose-aware surfaces are added.

export type AssessmentPurpose = "hiring" | "promotion" | "development";

export function normalizePurpose(raw: string | null | undefined): AssessmentPurpose {
  return raw === "promotion" || raw === "development" ? raw : "hiring";
}

export type DecisionOption = {
  v: string;
  label: string;
  icon: string;
  cls: string;
};

const POSITIVE = "peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:text-emerald-700";
const NEUTRAL = "peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-checked:text-amber-700";
const NEGATIVE = "peer-checked:border-red-500 peer-checked:bg-red-50 peer-checked:text-red-700";

export const DECISION_OPTIONS: Record<AssessmentPurpose, DecisionOption[]> = {
  hiring: [
    { v: "shortlist", label: "Shortlist", icon: "checkCircle", cls: POSITIVE },
    { v: "hold", label: "Hold", icon: "clock", cls: NEUTRAL },
    { v: "reject", label: "Reject", icon: "x", cls: NEGATIVE },
  ],
  promotion: [
    { v: "recommend", label: "Recommend", icon: "checkCircle", cls: POSITIVE },
    { v: "needs_development_plan", label: "Needs Development Plan", icon: "clock", cls: NEUTRAL },
    { v: "not_yet_ready", label: "Not Yet Ready", icon: "x", cls: NEGATIVE },
  ],
  development: [
    { v: "strengths_identified", label: "Strengths Identified", icon: "checkCircle", cls: POSITIVE },
    { v: "growth_areas_identified", label: "Growth Areas Identified", icon: "clock", cls: NEUTRAL },
  ],
};

export const PURPOSE_META: Record<AssessmentPurpose, { label: string; reviewerNoun: string; reviewerTitle: string; blurb: string }> = {
  hiring: {
    label: "Hiring",
    reviewerNoun: "recruiter",
    reviewerTitle: "Recruiter decision",
    blurb: "Human-in-the-loop: your decision confirms (or overrides) the AI-assisted scores above.",
  },
  promotion: {
    label: "Promotion",
    reviewerNoun: "reviewer",
    reviewerTitle: "Promotion review",
    blurb: "Your decision confirms (or overrides) the AI-assisted scores above and informs the promotion outcome.",
  },
  development: {
    label: "Development",
    reviewerNoun: "reviewer",
    reviewerTitle: "Development review",
    blurb: "No hire/promote decision is attached — this captures strengths and growth areas for the employee's development plan.",
  },
};
