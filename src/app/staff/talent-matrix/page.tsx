import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Avatar, Card, Icon, PageHeader } from "@/components/ui";

type Bucket = "Low" | "Medium" | "High";

function bucketFor(score: number): Bucket {
  if (score >= 80) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

const BOX_META: Record<Bucket, Record<Bucket, { label: string; tone: string }>> = {
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

const POTENTIAL_ROWS: Bucket[] = ["High", "Medium", "Low"];
const PERFORMANCE_COLS: Bucket[] = ["Low", "Medium", "High"];

export default async function TalentMatrixPage() {
  const supabase = await createClient();

  const { data: candidateAssessments } = await supabase
    .from("candidate_assessments")
    .select(
      "id, overall_score, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, department), assessments(title)"
    )
    .not("overall_score", "is", null);

  const rows = (candidateAssessments || []) as unknown as {
    id: string;
    overall_score: number;
    candidate: { full_name: string; department: string | null } | null;
    assessments: { title: string } | null;
  }[];

  const ids = rows.map((r) => r.id);
  const { data: compScores } = ids.length
    ? await supabase
        .from("candidate_competency_scores")
        .select("candidate_assessment_id, score, competencies(category)")
        .in("candidate_assessment_id", ids)
    : { data: [] };

  const leadershipByCa = new Map<string, number[]>();
  for (const s of (compScores || []) as unknown as { candidate_assessment_id: string; score: number; competencies: { category: string } | null }[]) {
    if (s.competencies?.category === "Leadership") {
      const arr = leadershipByCa.get(s.candidate_assessment_id) || [];
      arr.push(s.score);
      leadershipByCa.set(s.candidate_assessment_id, arr);
    }
  }

  const plotted = rows.map((r) => {
    const leadershipScores = leadershipByCa.get(r.id);
    const potentialScore =
      leadershipScores && leadershipScores.length
        ? leadershipScores.reduce((a, b) => a + b, 0) / leadershipScores.length
        : r.overall_score;
    const usedFallback = !leadershipScores || leadershipScores.length === 0;
    return {
      id: r.id,
      name: r.candidate?.full_name || "Unnamed candidate",
      department: r.candidate?.department,
      assessmentTitle: r.assessments?.title,
      performance: r.overall_score,
      potential: potentialScore,
      performanceBucket: bucketFor(r.overall_score),
      potentialBucket: bucketFor(potentialScore),
      usedFallback,
    };
  });

  const grid: Record<Bucket, Record<Bucket, typeof plotted>> = {
    High: { Low: [], Medium: [], High: [] },
    Medium: { Low: [], Medium: [], High: [] },
    Low: { Low: [], Medium: [], High: [] },
  };
  for (const p of plotted) grid[p.potentialBucket][p.performanceBucket].push(p);

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader
        title="Talent Matrix"
        subtitle="A Performance × Potential view of scored candidates, in the tradition of the 9-box grid used across Korn Ferry, Mercer, and WTW succession-planning practice."
      />

      <Card className="p-5 mb-6 flex items-start gap-3">
        <Icon name="brain" className="w-5 h-5 text-accent-dark shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-muted leading-relaxed">
          <span className="font-semibold text-foreground">Performance</span> is each candidate&apos;s Overall Role
          Fit score from their assessment. <span className="font-semibold text-foreground">Potential</span> is their
          average score across Leadership-category competencies — a common proxy for future-readiness when a
          dedicated potential assessment isn&apos;t run. Where a candidate wasn&apos;t assessed on any Leadership
          competency, their overall score is used for potential too (marked with *). Buckets: Low &lt;60, Medium
          60&ndash;79, High 80+.
        </p>
      </Card>

      {plotted.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="font-semibold text-foreground">No scored candidates yet</p>
          <p className="text-sm text-muted mt-1.5 max-w-md mx-auto">
            Once candidates finish an assessment and receive an Overall Role Fit score, they&apos;ll be plotted here
            automatically.
          </p>
        </Card>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "auto repeat(3, 1fr)" }}>
          <div />
          {PERFORMANCE_COLS.map((c) => (
            <p key={c} className="text-center text-[10.5px] font-bold uppercase tracking-wider text-faint pb-2">
              {c} performance
            </p>
          ))}
          {POTENTIAL_ROWS.map((rBucket) => (
            <div key={rBucket} className="contents">
              <div className="flex items-center justify-end pr-3">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint [writing-mode:vertical-rl] rotate-180 sm:[writing-mode:horizontal-tb] sm:rotate-0">
                  {rBucket} potential
                </p>
              </div>
              {PERFORMANCE_COLS.map((cBucket) => {
                const meta = BOX_META[rBucket][cBucket];
                const cell = grid[rBucket][cBucket];
                return (
                  <div key={cBucket} className={`border rounded-2xl p-3.5 m-1.5 min-h-[132px] ${meta.tone}`}>
                    <p className="text-[10.5px] font-bold text-foreground/80 mb-2">{meta.label}</p>
                    <div className="space-y-1.5">
                      {cell.map((p) => (
                        <Link
                          key={p.id}
                          href={`/staff/candidates/${p.id}`}
                          className="flex items-center gap-2 bg-surface/80 hover:bg-surface rounded-lg px-2 py-1.5 transition-colors"
                        >
                          <Avatar name={p.name} className="w-6 h-6 text-[10px]" />
                          <span className="min-w-0">
                            <span className="block text-[11.5px] font-semibold text-foreground truncate">
                              {p.name}
                              {p.usedFallback ? "*" : ""}
                            </span>
                            <span className="block text-[10px] text-faint truncate">
                              Fit {Math.round(p.performance)} · Potential {Math.round(p.potential)}
                            </span>
                          </span>
                        </Link>
                      ))}
                      {cell.length === 0 && <p className="text-[10.5px] text-faint/70">—</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
