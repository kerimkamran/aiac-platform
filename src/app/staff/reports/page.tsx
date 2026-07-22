import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, Icon, PageHeader, StatCard, bandFor, categoryStyle } from "@/components/ui";
import { BandDistribution, PipelineFunnel } from "@/components/charts";

type CaRow = {
  id: string;
  assessment_id: string;
  status: string;
  overall_score: number | null;
  invited_at: string;
  submitted_at: string | null;
  candidate: { full_name: string; department: string | null } | null;
  assessments: { title: string } | null;
};

type CompRow = {
  candidate_assessment_id: string;
  score: number;
  competencies: { name: string; category: string } | null;
};

type ReviewRow = {
  candidate_assessment_id: string;
  decision: string;
  created_at: string;
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ assessment?: string; department?: string }>;
}) {
  const { assessment = "", department = "" } = await searchParams;
  const supabase = await createClient();

  const [{ data: caRows }, { data: compRows }, { data: reviewRows }] = await Promise.all([
    supabase
      .from("candidate_assessments")
      .select(
        "id, assessment_id, status, overall_score, invited_at, submitted_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, department), assessments(title)"
      )
      .order("invited_at", { ascending: false }),
    supabase.from("candidate_competency_scores").select("candidate_assessment_id, score, competencies(name, category)"),
    supabase
      .from("candidate_reviews")
      .select("candidate_assessment_id, decision, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const allRows = (caRows || []) as unknown as CaRow[];
  const allComp = (compRows || []) as unknown as CompRow[];
  const allReviews = (reviewRows || []) as unknown as ReviewRow[];

  const assessmentOptions = Array.from(
    new Map(allRows.map((r) => [r.assessment_id, r.assessments?.title || "Untitled assessment"])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));
  const departmentOptions = Array.from(new Set(allRows.map((r) => r.candidate?.department).filter(Boolean))) as string[];

  let rows = allRows;
  if (assessment) rows = rows.filter((r) => r.assessment_id === assessment);
  if (department) rows = rows.filter((r) => r.candidate?.department === department);

  const filteredIds = new Set(rows.map((r) => r.id));
  const comp = allComp.filter((c) => filteredIds.has(c.candidate_assessment_id) && c.competencies);

  const latestDecisionByCa = new Map<string, string>();
  for (const r of allReviews) {
    if (filteredIds.has(r.candidate_assessment_id) && !latestDecisionByCa.has(r.candidate_assessment_id)) {
      latestDecisionByCa.set(r.candidate_assessment_id, r.decision);
    }
  }

  // KPIs
  const scored = rows.filter((r) => r.overall_score !== null);
  const submittedCount = rows.filter((r) => r.submitted_at !== null).length;
  const completionRate = rows.length ? Math.round((submittedCount / rows.length) * 100) : null;

  // AI-reviewer agreement (Phase 2): does the human decision align with the
  // AI score band? >=70 aligns with a positive decision, 50-69 with hold,
  // <50 with reject. Divergences aren't errors -- they're the calibration
  // signal that tells you whether the AI bar is set right.
  const scoreByCa = new Map(allRows.filter((r) => r.overall_score !== null).map((r) => [r.id, r.overall_score as number]));
  const visibleCaIds = new Set(rows.map((r) => r.id));
  let agreeCount = 0;
  let overrideCount = 0;
  for (const rv of allReviews) {
    if (!visibleCaIds.has(rv.candidate_assessment_id)) continue;
    const score = scoreByCa.get(rv.candidate_assessment_id);
    if (score === undefined) continue;
    const aiBucket = score >= 70 ? "shortlist" : score >= 50 ? "hold" : "reject";
    if (rv.decision === aiBucket) agreeCount += 1;
    else overrideCount += 1;
  }
  const judged = agreeCount + overrideCount;
  const agreementRate = judged > 0 ? Math.round((agreeCount / judged) * 100) : null;
  const avgScore = scored.length
    ? Math.round((scored.reduce((s, r) => s + (r.overall_score || 0), 0) / scored.length) * 10) / 10
    : null;
  const pendingReview = rows.filter((r) => r.status === "scored").length;

  // Score distribution
  const bands = [
    { label: "Does Not Meet", test: (s: number) => s < 50 },
    { label: "Partially Meets", test: (s: number) => s >= 50 && s < 70 },
    { label: "Fully Meets", test: (s: number) => s >= 70 && s < 85 },
    { label: "Exceeds", test: (s: number) => s >= 85 },
  ].map((b) => ({
    label: b.label,
    count: scored.filter((r) => b.test(r.overall_score!)).length,
    hex: bandFor(b.label === "Does Not Meet" ? 0 : b.label === "Partially Meets" ? 50 : b.label === "Fully Meets" ? 70 : 85).hex,
  }));

  // Pipeline funnel
  const funnel = [
    { label: "Invited", count: rows.length },
    { label: "Started", count: rows.filter((r) => r.status !== "invited").length },
    { label: "AI scored", count: rows.filter((r) => ["scored", "reviewed"].includes(r.status)).length },
    { label: "Reviewed", count: rows.filter((r) => r.status === "reviewed").length },
  ];

  // Decision breakdown — grouped into positive/neutral/negative buckets so
  // hiring (shortlist/hold/reject), promotion (recommend/needs_development_plan/
  // not_yet_ready), and development (strengths_identified/growth_areas_identified)
  // decisions all roll up correctly rather than only counting hiring's own labels.
  const decisions = Array.from(latestDecisionByCa.values());
  const POSITIVE_DECISIONS = new Set(["shortlist", "recommend", "strengths_identified"]);
  const NEUTRAL_DECISIONS = new Set(["hold", "needs_development_plan", "growth_areas_identified"]);
  const NEGATIVE_DECISIONS = new Set(["reject", "not_yet_ready"]);
  const decisionStages = [
    { label: "Positive (shortlist / recommend / strengths)", count: decisions.filter((d) => POSITIVE_DECISIONS.has(d)).length },
    { label: "Neutral (hold / development plan)", count: decisions.filter((d) => NEUTRAL_DECISIONS.has(d)).length },
    { label: "Negative (reject / not yet ready)", count: decisions.filter((d) => NEGATIVE_DECISIONS.has(d)).length },
    { label: "No decision yet", count: rows.filter((r) => r.status === "scored" && !latestDecisionByCa.has(r.id)).length },
  ];

  // Org-wide competency averages
  const byCompetency = new Map<string, { name: string; category: string; scores: number[] }>();
  for (const c of comp) {
    const key = `${c.competencies!.category}::${c.competencies!.name}`;
    const entry = byCompetency.get(key) || { name: c.competencies!.name, category: c.competencies!.category, scores: [] };
    entry.scores.push(c.score);
    byCompetency.set(key, entry);
  }
  const competencyAverages = Array.from(byCompetency.values())
    .map((e) => ({ name: e.name, category: e.category, avg: e.scores.reduce((a, b) => a + b, 0) / e.scores.length, n: e.scores.length }))
    .sort((a, b) => b.avg - a.avg);
  const topStrengths = competencyAverages.slice(0, 5);
  const topGaps = competencyAverages.slice().reverse().slice(0, 5);

  // Per-assessment breakdown
  const byAssessment = new Map<string, { title: string; rows: CaRow[] }>();
  for (const r of rows) {
    const entry = byAssessment.get(r.assessment_id) || { title: r.assessments?.title || "Untitled assessment", rows: [] };
    entry.rows.push(r);
    byAssessment.set(r.assessment_id, entry);
  }
  const assessmentBreakdown = Array.from(byAssessment.entries())
    .map(([id, e]) => {
      const s = e.rows.filter((r) => r.overall_score !== null);
      return {
        id,
        title: e.title,
        candidates: e.rows.length,
        avgScore: s.length ? Math.round((s.reduce((a, r) => a + (r.overall_score || 0), 0) / s.length) * 10) / 10 : null,
        completionRate: e.rows.length ? Math.round((e.rows.filter((r) => r.submitted_at).length / e.rows.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.candidates - a.candidates);

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Aggregate view across every candidate and assessment — score distribution, pipeline health, decision outcomes, and org-wide competency strengths and gaps."
      />

      <div className="flex items-center gap-1 mb-6 border-b border-line">
        <span className="px-3.5 py-2.5 text-sm font-semibold text-foreground border-b-2 border-brand -mb-px">
          Overview
        </span>
        <Link
          href="/staff/reports/candidates"
          className="px-3.5 py-2.5 text-sm font-semibold text-muted hover:text-foreground transition-colors"
        >
          Candidates
        </Link>
      </div>

      {/* Filters */}
      <form action="/staff/reports" className="flex flex-wrap items-center gap-2.5 mb-8">
        <Icon name="filter" className="w-4 h-4 text-faint" />
        <select
          name="assessment"
          defaultValue={assessment}
          className="bg-surface border border-line rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All assessments</option>
          {assessmentOptions.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
        <select
          name="department"
          defaultValue={department}
          className="bg-surface border border-line rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All departments / structures</option>
          {departmentOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button className="bg-brand text-white text-xs font-semibold px-3.5 py-2 rounded-xl hover:bg-brand-light transition-colors">
          Apply
        </button>
        {(assessment || department) && (
          <Link href="/staff/reports" className="text-xs font-semibold text-muted hover:text-foreground">
            Clear filters
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="font-semibold text-foreground">No data for this filter yet</p>
          <p className="text-sm text-muted mt-1.5 max-w-md mx-auto">
            Once candidates are invited and assessed, aggregate reporting will appear here automatically.
          </p>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <StatCard label="Candidates in view" value={rows.length} icon="users" tone="brand" />
            <StatCard label="Completion rate" value={completionRate !== null ? `${completionRate}%` : "—"} icon="checkCircle" tone="accent" />
            <StatCard label="Avg. Role Fit Score" value={avgScore ?? "—"} icon="target" tone="amber" />
            <StatCard label="Awaiting human review" value={pendingReview} icon="eye" tone="violet" />
          </div>

          {agreementRate !== null && (
            <Card className="p-5 mb-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                <span className="font-bold text-foreground">AI–reviewer agreement: {agreementRate}%</span>{" "}
                — reviewers overrode the AI score band on {overrideCount} of {judged} decision
                {judged === 1 ? "" : "s"} in view.
              </p>
              <p className="text-xs text-faint max-w-sm">
                Frequent overrides in one direction usually mean the scoring bar needs recalibrating, not that either
                side is wrong.
              </p>
            </Card>
          )}

          {/* Charts row 1 */}
          <div className="grid lg:grid-cols-2 gap-5 mb-5">
            <Card className="p-6">
              <p className="text-sm font-bold text-foreground mb-1">Role Fit distribution</p>
              <p className="text-xs text-muted mb-5">Scored candidates per proficiency band</p>
              {scored.length > 0 ? (
                <BandDistribution buckets={bands} />
              ) : (
                <p className="text-sm text-faint py-10 text-center">No scored candidates yet.</p>
              )}
            </Card>
            <Card className="p-6">
              <p className="text-sm font-bold text-foreground mb-1">Pipeline funnel</p>
              <p className="text-xs text-muted mb-6">Where candidates are in the journey</p>
              <PipelineFunnel stages={funnel} />
            </Card>
          </div>

          {/* Decision breakdown */}
          <Card className="p-6 mb-5">
            <p className="text-sm font-bold text-foreground mb-1">Decision outcomes</p>
            <p className="text-xs text-muted mb-6">Recruiter/decision-maker calls across AI-scored candidates</p>
            <PipelineFunnel stages={decisionStages} />
          </Card>

          {/* Competency strengths & gaps */}
          <div className="grid lg:grid-cols-2 gap-5 mb-5">
            <Card className="p-6">
              <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                <Icon name="trending" className="w-4 h-4 text-emerald-600" />
                Org-wide strengths
              </p>
              <p className="text-xs text-muted mb-5">Highest-scoring competencies across all candidates in view</p>
              {topStrengths.length > 0 ? (
                <div className="space-y-3.5">
                  {topStrengths.map((c) => {
                    const style = categoryStyle(c.category);
                    return (
                      <div key={c.name}>
                        <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                          <span className="font-medium text-foreground flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            {c.name}
                          </span>
                          <span className="font-bold tabular-nums">{Math.round(c.avg)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-line/70 overflow-hidden">
                          <div className="h-full rounded-full anim-grow" style={{ width: `${c.avg}%`, background: style.hex }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-faint py-6 text-center">No competency scores yet.</p>
              )}
            </Card>
            <Card className="p-6">
              <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                <Icon name="target" className="w-4 h-4 text-amber-600" />
                Org-wide development gaps
              </p>
              <p className="text-xs text-muted mb-5">Lowest-scoring competencies across all candidates in view</p>
              {topGaps.length > 0 ? (
                <div className="space-y-3.5">
                  {topGaps.map((c) => {
                    const style = categoryStyle(c.category);
                    return (
                      <div key={c.name}>
                        <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                          <span className="font-medium text-foreground flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            {c.name}
                          </span>
                          <span className="font-bold tabular-nums">{Math.round(c.avg)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-line/70 overflow-hidden">
                          <div className="h-full rounded-full anim-grow" style={{ width: `${c.avg}%`, background: style.hex }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-faint py-6 text-center">No competency scores yet.</p>
              )}
            </Card>
          </div>

          {/* Per-assessment breakdown */}
          <Card className="overflow-hidden">
            <div className="px-6 pt-5 pb-4">
              <p className="text-sm font-bold text-foreground">Breakdown by assessment</p>
              <p className="text-xs text-muted mt-0.5">Candidate volume, average score, and completion rate per assessment</p>
            </div>
            <div className="divide-y divide-line border-t border-line">
              {assessmentBreakdown.map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-6 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{a.title}</p>
                    <p className="text-xs text-muted">{a.candidates} candidate{a.candidates === 1 ? "" : "s"} · {a.completionRate}% completed</p>
                  </div>
                  {a.avgScore !== null ? (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ring-1 ring-inset tabular-nums shrink-0 ${bandFor(a.avgScore).badge}`}>
                      avg {a.avgScore}
                    </span>
                  ) : (
                    <span className="text-xs text-faint shrink-0">not yet scored</span>
                  )}
                  <Link
                    href={`/staff/reports/candidates${a.id ? `?vacancy=${encodeURIComponent(a.title)}` : ""}`}
                    className="text-xs font-semibold text-accent-dark hover:underline shrink-0"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
