import { VantageMark } from "@/components/VantageMark";
import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Surfaces";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPill, type PillTone } from "@/components/ui/StatusPill";

export { Icon, Card };

/* ---------------- Brand ---------------- */

// The Vantage logo (Clear Horizon plan, sections 5.5 and 9): the mark, the
// wordmark, and "Azerconnect Group" after a hairline. The mark is VantageMark.
export function LogoMark({ className = "w-8 h-8" }: { className?: string }) {
  return <VantageMark className={className} tile />;
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <VantageMark className="w-8 h-8 shrink-0" />
      <span className="text-lg font-semibold tracking-tight text-foreground">Vantage</span>
      {!compact && (
        <span className="hidden sm:inline-flex items-center gap-3 text-sm text-muted whitespace-nowrap">
          <span aria-hidden className="h-4 w-px bg-line" />
          Azerconnect Group
        </span>
      )}
    </span>
  );
}

/* ---------------- Proficiency bands ---------------- */

export type Band = { label: string; badge: string; bar: string; hex: string };

// Design-execution-plan Phase 3 / T3.1 (found via the same due diligence,
// not one of the chart module's four): `hex` here fed BandDistribution's
// SVG bar fill directly as a static literal, disconnected from the
// Tailwind class two fields over that already names the correct,
// theme-aware color. "Fully Meets" was the worst case -- #1a1a1a on the
// dark card surface is ~1.03:1, essentially invisible -- but all four were
// wrong the same way, just less severely. Each now reads the same CSS
// custom property its own `bar`/`dot` class already resolves to.
export function bandFor(score: number): Band {
  if (score >= 85) return { label: "Exceeds", badge: "bg-good-soft text-good", bar: "bg-good", hex: "var(--good)" };
  if (score >= 70) return { label: "Fully meets", badge: "bg-accent-soft text-accent-dark", bar: "bg-accent", hex: "var(--accent)" };
  if (score >= 50) return { label: "Partially meets", badge: "bg-warning-soft text-warning", bar: "bg-warning", hex: "var(--warning)" };
  return { label: "Does not meet", badge: "bg-critical-soft text-critical", bar: "bg-critical", hex: "var(--critical)" };
}

export const CATEGORY_COLORS: Record<string, { text: string; bg: string; dot: string; hex: string }> = {
  Core: { text: "text-foreground", bg: "bg-line-soft", dot: "bg-foreground", hex: "var(--chart-1)" },
  Leadership: { text: "text-accent-dark", bg: "bg-accent-soft", dot: "bg-accent", hex: "var(--chart-4)" },
  Functional: { text: "text-muted", bg: "bg-line-soft", dot: "bg-line-strong", hex: "var(--chart-2)" },
};

export function categoryStyle(category: string) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Core;
}

/* ---------------- Status ---------------- */

// Status labels (Clear Horizon plan, sections 12.1 and 16). Staff see the
// review state; candidates see plain language, and "AI scored" never appears.
const STATUS_META: Record<string, { label: string; candidate?: string; tone: PillTone }> = {
  invited: { label: "Invited", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  submitted: { label: "Submitted", candidate: "Submitted", tone: "neutral" },
  scored: { label: "Awaiting review", candidate: "Being reviewed by a person", tone: "info" },
  reviewed: { label: "Reviewed", candidate: "Result ready", tone: "good" },
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "good" },
  shortlist: { label: "Shortlisted", tone: "good" },
  hold: { label: "On hold", tone: "warning" },
  reject: { label: "Rejected", tone: "critical" },
  recommend: { label: "Recommended", tone: "good" },
  needs_development_plan: { label: "Needs development plan", tone: "warning" },
  not_yet_ready: { label: "Not yet ready", tone: "critical" },
  strengths_identified: { label: "Strengths identified", tone: "good" },
  growth_areas_identified: { label: "Growth areas identified", tone: "info" },
  active: { label: "Active", tone: "good" },
  deactivated: { label: "Deactivated", tone: "neutral" },
};

export function StatusBadge({ status, audience = "staff" }: { status: string; audience?: "staff" | "candidate" }) {
  const meta = STATUS_META[status];
  const label = meta ? (audience === "candidate" && meta.candidate ? meta.candidate : meta.label) : status.replace(/_/g, " ");
  return <StatusPill tone={meta?.tone ?? "neutral"}>{label}</StatusPill>;
}

export function ScoreBadge({ score }: { score: number }) {
  // v4 "Field": the score is just bold tabular text, no pill/badge chrome --
  // matches the approved dashboard mockup where scores read as plain numbers.
  return <span className="text-sm font-semibold tabular-nums text-foreground">{score}</span>;
}

// Visible, plain-language disclosure of how scores are actually produced,
// shown wherever a reviewer or candidate sees a score so the mechanism is
// never learned only by reading fine print in a rationale string.
//
// This copy used to describe an earlier, keyword-heuristic-only scorer --
// MCQ exact, free text via "word count and keyword signals, not a model
// reading for substance." src/lib/scoring.ts has since moved to real
// LLM-based grading (AIAC-SRS Part 4) as the primary path: free-text answers
// are graded by the configured engine (Claude/Sakana Fugu/Kimi) against the
// competency's own behavioural indicators, with a written rationale: see
// scoreTextResponse() there. The word-count/sentence-structure heuristic
// this disclosure used to describe as the norm still exists, but only as the
// fallback for when no engine is configured or a call fails -- it was never
// updated here when that changed, which is a real accuracy problem: it told
// reviewers to discount AI-graded scores as if they were the cruder
// heuristic. Corrected to describe the actual (LLM-primary,
// heuristic-fallback) behavior, including that either path can flag a score
// for human confirmation.
export function ScoringDisclosure({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-lg bg-warning-soft px-4 py-3 ${className}`}>
      <Icon name="info" className="w-5 h-5 text-warning shrink-0" />
      <p className="text-sm text-warning">
        <span className="font-bold">How scores are calculated:</span> Multiple-choice questions are scored exactly
        (correct/incorrect). Free-text answers are graded by an AI model against the competency&rsquo;s own behavioural
        indicators, with a written rationale for each score — falling back to a length/structure heuristic only if no
        scoring engine is configured. Either way, low-confidence scores are flagged for human review; read the
        written answers and rationale yourself before deciding.
      </p>
    </div>
  );
}

/* ---------------- Layout primitives ---------------- */

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  // Plain type sets the hierarchy: a headline, a quiet line under it, and the
  // page's actions on the right.
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-headline text-foreground">{title}</h1>
        {subtitle && <p className="text-base text-muted mt-1.5 measure">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}

// Design-execution-plan Phase 1 / T1.4: dropped `icon` and `tone` -- both
// were kept only for backward compatibility with call sites from an older
// design (an icon-in-a-tinted-box stat treatment), explicitly never
// rendered (`void icon; void tone;`), and every call site in the app still
// passed them anyway. Removed here; the twelve call sites (admin, staff
// reports, candidate dashboard) had their now-invalid icon/tone props
// stripped in the same change.
export function StatCard({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={emphasis ? "sm:col-span-2" : ""}>
      <p className="text-sm text-muted font-medium mb-1.5">{label}</p>
      <p className={`font-semibold tabular-nums tracking-tight text-3xl ${emphasis ? "text-accent-dark" : "text-foreground"}`}>
        {value}
      </p>
      {hint && <p className="text-sm text-muted mt-1">{hint}</p>}
    </div>
  );
}

export function Avatar({ name, className = "w-9 h-9 text-xs" }: { name: string; className?: string }) {
  const initials = (name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  // v4 "Field": flat neutral fill, not a brand gradient -- avatars shouldn't
  // compete with the one accent color reserved for the page's key action.
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-accent-soft text-accent-dark font-semibold shrink-0 ${className}`}
    >
      {initials}
    </span>
  );
}

export function ScoreRing({
  score,
  size = 120,
  label,
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const band = bandFor(score);
  const stroke = size >= 100 ? 9 : 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(score, 100) / 100);
  return (
    <div className="inline-flex flex-col items-center gap-2">
      <svg width={size} height={size} className="anim-ring" style={{ ["--ring-circ" as string]: `${circ}px` }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={band.hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="49%"
          dominantBaseline="central"
          textAnchor="middle"
          className="fill-foreground font-bold"
          style={{ fontSize: size / 3.4 }}
        >
          {score}
        </text>
      </svg>
      {label && (
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-sm ${band.badge}`}>{label}</span>
      )}
    </div>
  );
}

export function ProgressBar({ value, barClass = "bg-accent", className = "h-2" }: { value: number; barClass?: string; className?: string }) {
  return (
    <div className={`w-full bg-line-soft rounded-full overflow-hidden ${className}`}>
      <div className={`h-full rounded-full anim-grow ${barClass}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

// An empty state shows an "empty horizon": a hairline with one faint node,
// then a short title, a line of help and at most one action.
export function EmptyState({
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <Card className="p-10 text-center">
      <svg viewBox="0 0 160 24" className="mx-auto w-40 h-6 mb-5" aria-hidden>
        <line x1="0" y1="12" x2="160" y2="12" style={{ stroke: "var(--line)" }} strokeWidth="1.5" />
        <circle cx="80" cy="12" r="5" style={{ fill: "var(--surface)", stroke: "var(--line-control)" }} strokeWidth="1.5" />
      </svg>
      <p className="text-lg font-semibold text-foreground">{title}</p>
      <p className="text-base text-muted mt-1.5 max-w-sm mx-auto">{body}</p>
      {action && (
        <div className="mt-6">
          <ButtonLink href={action.href}>
            {action.label}
            <Icon name="arrowRight" className="w-4 h-4" />
          </ButtonLink>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Status journey tracker ---------------- */

const JOURNEY = ["invited", "in_progress", "submitted", "scored", "reviewed"] as const;
const JOURNEY_LABELS = ["Invited", "In progress", "Submitted", "Being reviewed", "Result ready"];

// A compact path for lists (the candidate home draws the full PathHorizon).
export function JourneyTracker({ status }: { status: string }) {
  const activeIdx = Math.max(0, JOURNEY.indexOf(status as (typeof JOURNEY)[number]));
  return (
    <ol className="flex items-center w-full max-w-md" aria-label={`Progress: ${JOURNEY_LABELS[activeIdx]}`}>
      {JOURNEY.map((step, i) => (
        <li key={step} className="flex items-center flex-1 last:flex-none" aria-current={i === activeIdx ? "step" : undefined}>
          <span className="flex flex-col items-center gap-1.5">
            <span
              className={`w-3 h-3 rounded-full ${
                i < activeIdx ? "bg-good" : i === activeIdx ? "bg-surface ring-2 ring-accent" : "bg-surface ring-1 ring-line-control"
              }`}
            />
            <span className={`text-xs whitespace-nowrap ${i === activeIdx ? "text-foreground font-semibold" : "text-muted"}`}>
              {JOURNEY_LABELS[i]}
            </span>
          </span>
          {i < JOURNEY.length - 1 && <span aria-hidden className={`h-px flex-1 mx-1.5 -mt-5 ${i < activeIdx ? "bg-good" : "bg-line"}`} />}
        </li>
      ))}
    </ol>
  );
}

/* ---------------- Executive summary & benchmarking (advanced reporting) ---------------- */

import type { ExecutiveSummary, Benchmark } from "@/lib/reporting";

const RECOMMENDATION_TONE_CLS: Record<ExecutiveSummary["recommendationTone"], string> = {
  emerald: "bg-good-soft text-good ring-good/30",
  accent: "bg-good-soft text-good ring-good/30",
  amber: "bg-warning-soft text-warning ring-warning/30",
  red: "bg-critical-soft text-critical ring-critical/30",
};

export function ExecutiveSummaryCard({ summary }: { summary: ExecutiveSummary }) {
  return (
    <Card className="p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Icon name="sparkles" className="w-4 h-4 text-accent-dark" />
          Executive summary
        </p>
        <span className={`text-2xs font-bold px-2.5 py-1 rounded-full ring-1 ring-inset ${RECOMMENDATION_TONE_CLS[summary.recommendationTone]}`}>
          {summary.recommendationLabel}
        </span>
      </div>
      <p className="text-sm text-foreground leading-relaxed mb-4">{summary.headline}</p>
      <div className="grid sm:grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.14em] text-muted mb-2">Strengths</p>
          {summary.strengths.length > 0 ? (
            <ul className="space-y-1.5">
              {summary.strengths.map((s, i) => (
                <li key={i} className="text-xs text-muted flex items-start gap-1.5">
                  <Icon name="checkCircle" className="w-3.5 h-3.5 text-good shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No standout competencies above 60 yet.</p>
          )}
        </div>
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.14em] text-muted mb-2">Development areas</p>
          {summary.developmentAreas.length > 0 ? (
            <ul className="space-y-1.5">
              {summary.developmentAreas.map((s, i) => (
                <li key={i} className="text-xs text-muted flex items-start gap-1.5">
                  <Icon name="target" className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No competencies below 70 — solid across the board.</p>
          )}
        </div>
      </div>
      {summary.comparisonSentence && (
        <p className="text-2xs text-muted border-t border-line/70 pt-3 mt-1">{summary.comparisonSentence}</p>
      )}
      <p className="text-2xs text-muted/80 mt-3 italic">
        AI-assisted synthesis, human review required — not a sole basis for a hiring decision.
      </p>
    </Card>
  );
}

export function BenchmarkCard({
  benchmark,
  assessmentTitle,
  boxLabel,
  boxHref,
}: {
  benchmark: Benchmark;
  assessmentTitle?: string;
  boxLabel?: string | null;
  boxHref?: string;
}) {
  if (benchmark.percentile === null || benchmark.peerAvg === null) return null;
  const deltaPositive = (benchmark.delta ?? 0) >= 0;
  return (
    <Card className="p-6 mb-6">
      <p className="text-2xs font-bold uppercase tracking-[0.16em] text-muted mb-3">Benchmark vs. other candidates</p>
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-2xl font-bold text-accent-dark tabular-nums shrink-0">
          {benchmark.percentile}
          <span className="text-sm font-semibold text-muted">th pct</span>
        </p>
        <div className="flex-1 min-w-[160px]">
          <div className="h-2.5 rounded-full bg-line/70 overflow-hidden relative">
            <div className="h-full rounded-full bg-brand anim-grow" style={{ width: `${benchmark.percentile}%` }} />
          </div>
          <p className="text-xs text-muted mt-2">
            Scored higher than {benchmark.percentile}% of {benchmark.peerCount} candidate{benchmark.peerCount === 1 ? "" : "s"}
            {assessmentTitle ? (
              <>
                {" "}
                assessed for <span className="font-medium text-foreground">{assessmentTitle}</span>
              </>
            ) : (
              ""
            )}
            .
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xs font-bold uppercase tracking-wider text-muted">Peer avg</p>
          <p className="text-sm font-bold text-foreground tabular-nums">{benchmark.peerAvg}</p>
          <p className={`text-2xs font-semibold ${deltaPositive ? "text-good" : "text-critical"}`}>
            {deltaPositive ? "+" : ""}
            {benchmark.delta}
          </p>
        </div>
      </div>
      {boxLabel && (
        <div className="mt-4 pt-4 border-t border-line/70 flex items-center gap-2.5">
          <Icon name="chart" className="w-4 h-4 text-accent-dark shrink-0" />
          <p className="text-xs text-muted">
            Talent Matrix placement:{" "}
            {boxHref ? (
              <Link href={boxHref} className="font-semibold text-accent-dark hover:underline">
                {boxLabel}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">{boxLabel}</span>
            )}
          </p>
        </div>
      )}
    </Card>
  );
}
