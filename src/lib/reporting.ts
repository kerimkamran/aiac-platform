// Shared reporting logic used across the staff/decision candidate review pages,
// the PDF export, and the analytics dashboard — so benchmarking, talent-box
// placement, and the executive-summary narrative stay identical everywhere
// a candidate's results are shown.

export type Bucket = "Low" | "Medium" | "High";

export function scoreBucket(score: number): Bucket {
  if (score >= 80) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

export const TALENT_BOX_META: Record<Bucket, Record<Bucket, { label: string; tone: string }>> = {
  High: {
    Low: { label: "Enigma", tone: "bg-amber-50 border-amber-200" },
    Medium: { label: "Growth Employee", tone: "bg-accent-soft border-accent/30" },
    High: { label: "Future Leader", tone: "bg-emerald-50 border-emerald-300" },
  },
  Medium: {
    Low: { label: "Inconsistent Player", tone: "bg-amber-50 border-amber-200" },
    Medium: { label: "Core Player", tone: "bg-accent-soft border-accent/20" },
    High: { label: "High Performer", tone: "bg-emerald-50 border-emerald-200" },
  },
  Low: {
    Low: { label: "Risk", tone: "bg-red-50 border-red-200" },
    Medium: { label: "Trusted Professional", tone: "bg-accent-soft border-line" },
    High: { label: "Solid Performer", tone: "bg-accent-soft border-line" },
  },
};

export function talentBoxFor(performanceScore: number, potentialScore: number) {
  const perfBucket = scoreBucket(performanceScore);
  const potBucket = scoreBucket(potentialScore);
  return { ...TALENT_BOX_META[potBucket][perfBucket], performanceBucket: perfBucket, potentialBucket: potBucket };
}

/* ---------------- Benchmarking ---------------- */

export type Benchmark = {
  percentile: number | null;
  peerAvg: number | null;
  peerCount: number;
  delta: number | null;
};

export function computeBenchmark(score: number | null, peerScores: number[]): Benchmark {
  const clean = peerScores.filter((s) => typeof s === "number" && !Number.isNaN(s));
  const peerCount = clean.length;
  if (score === null || peerCount === 0) return { percentile: null, peerAvg: null, peerCount, delta: null };

  const peerAvg = Math.round((clean.reduce((a, b) => a + b, 0) / peerCount) * 10) / 10;
  const percentile =
    peerCount > 1 ? Math.round((clean.filter((s) => s < score).length / (peerCount - 1)) * 100) : null;
  const delta = Math.round((score - peerAvg) * 10) / 10;

  return { percentile, peerAvg, peerCount, delta };
}

/* ---------------- Executive summary ---------------- */
/* Template-generated, matching the Phase-1 rule-based scoring engine's       */
/* approach — deterministic, not a live LLM call.                            */

export type CompetencyLine = { name: string; category: string; score: number; level: string };

export type ExecutiveSummary = {
  headline: string;
  recommendationLabel: "Strong fit" | "Fit with reservations" | "Borderline" | "Not yet meeting bar";
  recommendationTone: "emerald" | "accent" | "amber" | "red";
  strengths: string[];
  developmentAreas: string[];
  comparisonSentence: string | null;
};

function bandLabel(score: number): ExecutiveSummary["recommendationLabel"] {
  if (score >= 85) return "Strong fit";
  if (score >= 70) return "Fit with reservations";
  if (score >= 50) return "Borderline";
  return "Not yet meeting bar";
}

function toneFor(score: number): ExecutiveSummary["recommendationTone"] {
  if (score >= 85) return "emerald";
  if (score >= 70) return "accent";
  if (score >= 50) return "amber";
  return "red";
}

export function buildExecutiveSummary(params: {
  candidateName: string;
  overallScore: number;
  competencies: CompetencyLine[];
  benchmark: Benchmark;
  boxLabel?: string | null;
}): ExecutiveSummary {
  const { candidateName, overallScore, competencies, benchmark, boxLabel } = params;
  const firstName = (candidateName || "This candidate").split(/\s+/)[0];

  const sorted = [...competencies].sort((a, b) => b.score - a.score);
  const strengths = sorted.slice(0, 3).filter((c) => c.score >= 60).map((c) => `${c.name} (${Math.round(c.score)})`);
  const developmentAreas = sorted
    .slice()
    .reverse()
    .slice(0, 3)
    .filter((c) => c.score < 70)
    .map((c) => `${c.name} (${Math.round(c.score)})`);

  const recommendationLabel = bandLabel(overallScore);
  const recommendationTone = toneFor(overallScore);

  const headline =
    recommendationLabel === "Strong fit"
      ? `${firstName} demonstrates strong, well-rounded capability against this role's competency model.`
      : recommendationLabel === "Fit with reservations"
        ? `${firstName} meets the bar on most mapped competencies, with a few areas worth probing further in interview.`
        : recommendationLabel === "Borderline"
          ? `${firstName}'s results are mixed — some competencies land above the bar, others fall short.`
          : `${firstName}'s scored responses fall mostly below the expected bar for this role's competency model.`;

  let comparisonSentence: string | null = null;
  if (benchmark.percentile !== null && benchmark.peerAvg !== null) {
    const vsPeers =
      benchmark.delta !== null && benchmark.delta > 0
        ? `${benchmark.delta.toFixed(1)} points above`
        : benchmark.delta !== null && benchmark.delta < 0
          ? `${Math.abs(benchmark.delta).toFixed(1)} points below`
          : "in line with";
    comparisonSentence = `Scored higher than ${benchmark.percentile}% of the ${benchmark.peerCount} candidate(s) assessed for this role — ${vsPeers} the peer average of ${benchmark.peerAvg}.${
      boxLabel ? ` Talent Matrix placement: ${boxLabel}.` : ""
    }`;
  } else if (boxLabel) {
    comparisonSentence = `Talent Matrix placement: ${boxLabel}.`;
  }

  return { headline, recommendationLabel, recommendationTone, strengths, developmentAreas, comparisonSentence };
}

/* ---------------- Potential proxy (for Talent Matrix placement) ---------------- */

export function potentialFromCompetencies(overallScore: number, competencies: CompetencyLine[]) {
  const leadership = competencies.filter((c) => c.category === "Leadership").map((c) => c.score);
  if (leadership.length === 0) return { potential: overallScore, usedFallback: true };
  return { potential: leadership.reduce((a, b) => a + b, 0) / leadership.length, usedFallback: false };
}

/* ---------------- Category rollups ---------------- */

export function categoryRollups(competencies: CompetencyLine[]) {
  return ["Core", "Leadership", "Functional"]
    .map((cat) => {
      const rows = competencies.filter((c) => c.category === cat);
      const avg = rows.length ? Math.round((rows.reduce((a, b) => a + b.score, 0) / rows.length) * 10) / 10 : null;
      return { cat, rows, avg };
    })
    .filter((g) => g.rows.length > 0);
}
