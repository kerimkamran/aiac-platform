import Link from "next/link";

/* ---------------- Icons ---------------- */

const ICON_PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  clipboard: "M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM8 6H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2M9 12h6M9 16h4",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75",
  chart: "M3 3v18h18M8 17V9m5 8V5m5 12v-6",
  wand: "M15 4V2m0 20v-2m5-5h2M3 15h2m11.5-8.5L18 5m-9.5 9.5L4 19m12.5-4.5L18 16M8.5 8.5 7 7m4 4 9 9",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 3",
  check: "M20 6 9 17l-5-5",
  checkCircle: "M22 11.1V12a10 10 0 1 1-5.93-9.14M22 4 12 14l-3-3",
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  arrowLeft: "M19 12H5m6 6-6-6 6-6",
  arrowUp: "M12 19V5m-6 6 6-6 6 6",
  arrowDown: "M12 5v14m6-6-6 6-6-6",
  sparkles: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9zM5 16l.7 1.6L7.3 18l-1.6.7L5 20.3 4.3 18.7 2.7 18l1.6-.4z",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-5a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  layers: "m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5",
  shield: "M12 22s8-3.6 8-10V5.2L12 2 4 5.2V12c0 6.4 8 10 8 10zM9 12l2 2 4-4",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9",
  menu: "M4 6h16M4 12h16M4 18h16",
  x: "M18 6 6 18M6 6l12 12",
  plus: "M12 5v14M5 12h14",
  printer: "M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2m-12-3h12v6H6z",
  send: "m22 2-7 20-4-9-9-4 20-7zM22 2 11 13",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M9 13h6M9 17h6",
  award: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm-3.5-1.5L7 22l5-3 5 3-1.5-8.5",
  zap: "M13 2 3 14h8l-1 8 11-13h-8l1-7z",
  brain: "M12 4a3 3 0 0 0-3 3v10a3 3 0 1 0 6 0V7a3 3 0 0 0-3-3zM9 8H7a3 3 0 0 0 0 6h2m6-6h2a3 3 0 0 1 0 6h-2",
  building: "M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16m-12 0h16m-4 0v-8h4v8M8 7h2m-2 4h2m-2 4h2",
  timer: "M10 2h4M12 14l3-3m-3 11a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2 8 7 8-7",
  image: "M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm2 12 4-5 3 3 3-4 5 6M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  download: "M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  filter: "M4 5h16l-6 8v6l-4 2v-8z",
  video: "M15 8v8H3V8h12zm0 3 6-4v10l-6-4z",
  camera: "M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  ban: "M4.9 4.9 19 19M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  play: "M6 4l14 8-14 8V4z",
  trash: "M4 7h16M9 7V4h6v3m-9 0 1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13",
  command: "M6 9a3 3 0 1 1 3 3H6V9zm0 0v6m0 0a3 3 0 1 0 3 3v-3H6zm6-6a3 3 0 1 1 3-3v3h-3zm0 0h6m-6 0a3 3 0 1 0-3 3h3V9zm6 6a3 3 0 1 1-3 3v-3h3zm0 0h-6m6 0a3 3 0 1 0 3-3h-3v3z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v3m0 16v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M1 12h3m16 0h3M4.2 19.8l2.1-2.1m11.4-11.4 2.1-2.1",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  trending: "M3 17l6-6 4 4 8-8M15 7h6v6",
  alertTriangle: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4m0 4h.01",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-5m0-3.5h.01",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3.5 2",
  keyboard: "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM6 9h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M6 12h.01M9 12h.01M12 12h.01M15 12h.01M18 12h.01M8 15h8",
  messageSquare: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
};

// Design-execution-plan Phase 2 / T2.1: icons are decorative (aria-hidden) by
// default, since almost every use sits beside its own visible text. Pass
// `label` for the rare icon that IS the only content of its container (an
// icon-only button with nothing else to name it) -- it switches the SVG to
// role="img" with that accessible name instead of hiding it from AT.
export function Icon({ name, className = "w-5 h-5", label }: { name: string; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <path d={ICON_PATHS[name] || ""} />
    </svg>
  );
}

/* ---------------- Brand ---------------- */

// "Vantage" mark: an ascending peak/chevron inside a rounded square -- reads
// as both an upward viewpoint (evidence -> clarity) and a growth signal.
// Design-execution-plan Phase 1 / T1.4: this comment used to describe an
// "indigo -> emerald brand gradient" that the mark never actually draws --
// it's a flat near-black square (below) with one flat accent-color dot,
// matching the rest of the v4 "Field" system (one accent color, used
// sparingly, never as a gradient or mesh). Corrected to describe what's
// actually rendered.
export function LogoMark({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="12" fill="#1a1a1a" />
      <path d="M14 40 L28 22 L36 32 L50 16" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="50" cy="16" r="5.5" fill="var(--accent)" />
    </svg>
  );
}

// Design-execution-plan Phase 1 / T1.4: dropped the `dark` prop -- every
// call site in the app used the default (false); the true-branch styling
// (white text, for placing the logo on a dark panel) was dead code no
// caller ever reached. If a dark-panel placement is needed later, it's a
// one-line prop to re-add with a real call site attached.
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className="w-8 h-8 shrink-0" />
      {!compact && (
        <span className="font-semibold leading-none tracking-tight [font-family:var(--font-display)] text-accent-dark">
          <span className="block text-base">Vantage</span>
          <span className="block text-2xs font-medium uppercase tracking-[0.18em] mt-1 font-sans text-accent-dark">
            by Azerconnect Group
          </span>
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
  if (score >= 85)
    return { label: "Exceeds", badge: "bg-[#eef3ef] text-[#3d7a4d]", bar: "bg-[#3d7a4d]", hex: "var(--good)" };
  if (score >= 70)
    return { label: "Fully Meets", badge: "bg-line-soft text-foreground", bar: "bg-foreground", hex: "var(--foreground)" };
  if (score >= 50)
    return { label: "Partially Meets", badge: "bg-brand-50 text-accent-dark", bar: "bg-accent", hex: "var(--accent)" };
  return { label: "Does Not Meet", badge: "bg-[#fbeceb] text-[#b23b3b]", bar: "bg-[#b23b3b]", hex: "var(--critical)" };
}

export const CATEGORY_COLORS: Record<string, { text: string; bg: string; dot: string; hex: string }> = {
  Core: { text: "text-foreground", bg: "bg-line-soft", dot: "bg-foreground", hex: "var(--foreground)" },
  Leadership: { text: "text-accent-dark", bg: "bg-brand-50", dot: "bg-accent", hex: "var(--accent)" },
  Functional: { text: "text-muted", bg: "bg-line-soft", dot: "bg-line-strong", hex: "var(--line-strong)" },
};

export function categoryStyle(category: string) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Core;
}

/* ---------------- Status ---------------- */

// v4 "Field": three semantic hues only -- neutral (default/waiting), green
// (good/complete), clay (needs attention/in progress) -- plus plain gray for
// terminal/inactive states. Down from six competing hues in v3 so status
// pills read as calm data, not a rainbow of chips.
const STATUS_META: Record<string, { label: string; cls: string }> = {
  invited: { label: "Invited", cls: "bg-line-soft text-muted" },
  in_progress: { label: "In progress", cls: "bg-brand-50 text-accent-dark" },
  submitted: { label: "Submitted", cls: "bg-line-soft text-muted" },
  scored: { label: "Scored — awaiting review", cls: "bg-brand-50 text-accent-dark" },
  reviewed: { label: "Reviewed", cls: "bg-[#eef3ef] text-[#3d7a4d]" },
  draft: { label: "Draft", cls: "bg-line-soft text-muted" },
  published: { label: "Published", cls: "bg-[#eef3ef] text-[#3d7a4d]" },
  shortlist: { label: "Shortlisted", cls: "bg-[#eef3ef] text-[#3d7a4d]" },
  hold: { label: "On hold", cls: "bg-brand-50 text-accent-dark" },
  reject: { label: "Rejected", cls: "bg-[#fbeceb] text-[#b23b3b]" },
  recommend: { label: "Recommended", cls: "bg-[#eef3ef] text-[#3d7a4d]" },
  needs_development_plan: { label: "Needs development plan", cls: "bg-brand-50 text-accent-dark" },
  not_yet_ready: { label: "Not yet ready", cls: "bg-[#fbeceb] text-[#b23b3b]" },
  strengths_identified: { label: "Strengths identified", cls: "bg-[#eef3ef] text-[#3d7a4d]" },
  growth_areas_identified: { label: "Growth areas identified", cls: "bg-brand-50 text-accent-dark" },
  active: { label: "Active", cls: "bg-[#eef3ef] text-[#3d7a4d]" },
  deactivated: { label: "Deactivated", cls: "bg-line-soft text-muted" },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status.replace(/_/g, " "), cls: "bg-line-soft text-muted" };
  return (
    <span className={`inline-flex items-center text-2xs font-semibold px-2 py-[3px] rounded whitespace-nowrap ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  // v4 "Field": the score is just bold tabular text, no pill/badge chrome --
  // matches the approved dashboard mockup where scores read as plain numbers.
  return <span className="text-xs font-semibold tabular-nums text-foreground">{score}</span>;
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
    <div className={`flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 ${className}`}>
      <Icon name="info" className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
      <p className="text-2xs leading-relaxed text-amber-800">
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

export function Card({
  className = "",
  id,
  children,
  interactive = false,
}: {
  className?: string;
  id?: string;
  children: React.ReactNode;
  interactive?: boolean;
}) {
  // v4 "Field": a surface is defined by a hairline border, not a shadow.
  // No elevation, no squircle radius -- flat and sharp-cornered so cards
  // read as plain content containers rather than decorative "AI app" tiles.
  // `interactive` still gets a subtle border-darken on hover so clickable
  // rows have honest affordance without a lift/shadow flourish.
  return (
    <div
      id={id}
      className={`bg-surface border border-line rounded-md print-card ${interactive ? "hover:border-line-strong/50 cursor-pointer transition-colors" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  // v4 "Field": plain type sets the hierarchy -- no icon chip, no gradient,
  // no colored band. A page title is just a page title. Matches the
  // approved dashboard mockup (title + date/context on the baseline).
  return (
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <h1 className="text-xl leading-tight font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2.5">{children}</div>}
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
      <p className="text-2xs text-muted font-medium mb-1.5">{label}</p>
      <p className={`font-semibold tabular-nums tracking-tight ${emphasis ? "text-2xl text-accent" : "text-2xl text-foreground"}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
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
      className={`inline-flex items-center justify-center rounded-full bg-line-soft text-muted font-semibold shrink-0 ${className}`}
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
        <span className={`text-2xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset ${band.badge}`}>{label}</span>
      )}
    </div>
  );
}

export function ProgressBar({ value, barClass = "bg-accent", className = "h-2" }: { value: number; barClass?: string; className?: string }) {
  return (
    <div className={`w-full bg-line/70 rounded-full overflow-hidden ${className}`}>
      <div className={`h-full rounded-full anim-grow ${barClass}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function EmptyState({
  icon = "clipboard",
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
      <span className="mx-auto w-12 h-12 rounded-2xl bg-brand/8 text-accent-dark grid place-items-center mb-4">
        <Icon name={icon} className="w-6 h-6" />
      </span>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted mt-1.5 max-w-sm mx-auto">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-2 mt-5 bg-brand-deep text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand transition-colors"
        >
          {action.label}
          <Icon name="arrowRight" className="w-4 h-4" />
        </Link>
      )}
    </Card>
  );
}

/* ---------------- Status journey tracker ---------------- */

const JOURNEY = ["invited", "in_progress", "scored", "reviewed"] as const;
const JOURNEY_LABELS = ["Invited", "In progress", "AI scored", "Reviewed"];

export function JourneyTracker({ status }: { status: string }) {
  const normalized = status === "submitted" ? "scored" : status;
  const activeIdx = JOURNEY.indexOf(normalized as (typeof JOURNEY)[number]);
  return (
    <div className="flex items-center gap-0 w-full max-w-xs" aria-label={`Progress: ${status}`}>
      {JOURNEY.map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <span
              className={`w-5 h-5 rounded-full grid place-items-center ring-2 ${
                i < activeIdx
                  ? "bg-brand-deep ring-accent text-white"
                  : i === activeIdx
                    ? "bg-brand-deep ring-brand text-white"
                    : "bg-surface ring-line text-muted"
              }`}
            >
              {i < activeIdx ? <Icon name="check" className="w-3 h-3" /> : <span className="text-2xs font-bold">{i + 1}</span>}
            </span>
            <span className={`text-2xs font-medium whitespace-nowrap ${i <= activeIdx ? "text-foreground" : "text-muted"}`}>
              {JOURNEY_LABELS[i]}
            </span>
          </div>
          {i < JOURNEY.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 -mt-4 rounded ${i < activeIdx ? "bg-accent" : "bg-line"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Executive summary & benchmarking (advanced reporting) ---------------- */

import type { ExecutiveSummary, Benchmark } from "@/lib/reporting";

const RECOMMENDATION_TONE_CLS: Record<ExecutiveSummary["recommendationTone"], string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  accent: "bg-green-50 text-green-700 ring-green-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
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
                  <Icon name="checkCircle" className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
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
                  <Icon name="target" className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
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
          <p className={`text-2xs font-semibold ${deltaPositive ? "text-emerald-600" : "text-critical"}`}>
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
