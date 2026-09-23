"use client";

// A calm, professional "it's in" confirmation for candidates right after they
// submit an assessment -- a hand-drawn seal, no confetti. Design-execution-
// plan Phase 6 / T6.4: confetti previously fired on every submission,
// including one the countdown forced through at zero -- distracting at best
// and tone-deaf at worst for a job assessment. Removed rather than toned
// down, per the plan's own recommendation.

export function SubmissionSeal() {
  return (
    <div className="relative inline-flex items-center justify-center w-28 h-28 mb-2">
      <span className="anim-seal-ring absolute inset-0 rounded-full bg-accent/25" />
      <svg viewBox="0 0 100 100" className="anim-seal-pop relative w-24 h-24" role="img" aria-label="Submitted successfully">
        <circle cx="50" cy="50" r="46" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2.5" />
        <path
          d="M32 51 L44 63 L69 37"
          fill="none"
          stroke="var(--accent-dark)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="anim-seal-draw"
          style={{ ["--seal-len" as string]: 62 }}
        />
      </svg>
    </div>
  );
}
