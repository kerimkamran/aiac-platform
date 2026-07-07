import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Card, EmptyState, Icon, PageHeader, ScoreRing, StatusBadge, categoryStyle } from "@/components/ui";
import { RadarChart, RADAR_SERIES_COLORS } from "@/components/charts";
import { categoryRollups, type CompetencyLine } from "@/lib/reporting";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COMPARE = 4;

type Row = {
  id: string;
  assessment_id: string;
  status: string;
  overall_score: number | null;
  submitted_at: string | null;
  candidate: { full_name: string; email: string } | null;
  assessments: { title: string } | null;
};

type ScoreRow = {
  candidate_assessment_id: string;
  score: number;
  level: string;
  competencies: { name: string; category: string } | null;
};

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids: raw } = await searchParams;
  const requested = [...new Set((raw || "").split(",").map((s) => s.trim()).filter((s) => UUID_RE.test(s)))];
  const overflow = requested.length > MAX_COMPARE ? requested.length : 0;
  const ids = requested.slice(0, MAX_COMPARE);

  if (ids.length < 2) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl">
        <PageHeader title="Compare candidates" subtitle="Put 2–4 finalists side by side — overlaid competency profiles, per-competency winners, and category rollups." />
        <EmptyState
          icon="chart"
          title="Nothing to compare yet"
          body="Select 2–4 candidates from the Candidates list, then use the Compare bar that appears at the bottom of the screen."
          action={{ href: "/staff/candidates", label: "Go to Candidates" }}
        />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: caRows }, { data: scoreRows }, { data: reviewRows }] = await Promise.all([
    supabase
      .from("candidate_assessments")
      .select(
        "id, assessment_id, status, overall_score, submitted_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email), assessments(title)"
      )
      .in("id", ids),
    supabase
      .from("candidate_competency_scores")
      .select("candidate_assessment_id, score, level, competencies(name, category)")
      .in("candidate_assessment_id", ids),
    supabase
      .from("candidate_reviews")
      .select("candidate_assessment_id, decision, created_at")
      .in("candidate_assessment_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  const rows = (caRows || []) as unknown as Row[];
  // Preserve the URL's ordering so columns stay stable; drop ids that didn't resolve.
  const candidates = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is Row => !!r);

  if (candidates.length < 2) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl">
        <PageHeader title="Compare candidates" />
        <EmptyState
          icon="chart"
          title="Couldn't load enough candidates"
          body="Fewer than two of the selected candidates could be found. They may have been removed, or the link is out of date."
          action={{ href: "/staff/candidates", label: "Go to Candidates" }}
        />
      </div>
    );
  }

  const latestDecision = new Map<string, string>();
  for (const r of (reviewRows || []) as { candidate_assessment_id: string; decision: string }[]) {
    if (!latestDecision.has(r.candidate_assessment_id)) latestDecision.set(r.candidate_assessment_id, r.decision);
  }

  const scoresByCa = new Map<string, CompetencyLine[]>();
  for (const s of (scoreRows || []) as unknown as ScoreRow[]) {
    if (!s.competencies) continue;
    const list = scoresByCa.get(s.candidate_assessment_id) || [];
    list.push({ name: s.competencies.name, category: s.competencies.category, score: s.score, level: s.level });
    scoresByCa.set(s.candidate_assessment_id, list);
  }

  const colorFor = new Map(candidates.map((c, i) => [c.id, RADAR_SERIES_COLORS[i % RADAR_SERIES_COLORS.length]]));
  const mixedAssessments = new Set(candidates.map((c) => c.assessment_id)).size > 1;

  // Radar: intersection of competency names across candidates that have scores.
  const scored = candidates.filter((c) => (scoresByCa.get(c.id) || []).length > 0);
  let radarLabels: string[] = [];
  if (scored.length >= 2) {
    const nameSets = scored.map((c) => new Set((scoresByCa.get(c.id) || []).map((l) => l.name)));
    const shared = [...nameSets[0]].filter((n) => nameSets.every((set) => set.has(n)));
    radarLabels = shared
      .map((name) => ({
        name,
        avg:
          scored.reduce((sum, c) => sum + ((scoresByCa.get(c.id) || []).find((l) => l.name === name)?.score || 0), 0) /
          scored.length,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8)
      .map((x) => x.name);
  }
  const radarSeries = scored.map((c) => ({
    name: c.candidate?.full_name || "Unknown",
    color: colorFor.get(c.id)!,
    values: radarLabels.map((name) => Math.round((scoresByCa.get(c.id) || []).find((l) => l.name === name)?.score || 0)),
  }));

  // Table: union of competencies grouped by category.
  const unionByCategory = new Map<string, string[]>();
  for (const c of candidates) {
    for (const line of scoresByCa.get(c.id) || []) {
      const list = unionByCategory.get(line.category) || [];
      if (!list.includes(line.name)) list.push(line.name);
      unionByCategory.set(line.category, list);
    }
  }
  const categories = ["Core", "Leadership", "Functional"].filter((cat) => unionByCategory.has(cat));
  for (const extra of unionByCategory.keys()) if (!categories.includes(extra)) categories.push(extra);

  const scoreOf = (caId: string, name: string) => (scoresByCa.get(caId) || []).find((l) => l.name === name)?.score ?? null;
  const bestOf = (values: (number | null)[]) => {
    const nums = values.filter((v): v is number => v !== null);
    return nums.length ? Math.max(...nums) : null;
  };

  const rollups = new Map(candidates.map((c) => [c.id, categoryRollups(scoresByCa.get(c.id) || [])]));
  const rollupCats = ["Core", "Leadership", "Functional"].filter((cat) =>
    candidates.some((c) => (rollups.get(c.id) || []).some((g) => g.cat === cat))
  );

  const cols = candidates.length;
  const headerGrid = cols >= 4 ? "md:grid-cols-2 xl:grid-cols-4" : cols === 3 ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader
        title="Compare candidates"
        subtitle={`${cols} candidates side by side — competency overlay, per-competency winners, and category rollups.`}
      >
        <Link href="/staff/candidates" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-dark hover:underline">
          <Icon name="users" className="w-4 h-4" />
          Change selection
        </Link>
      </PageHeader>

      {overflow > 0 && (
        <p className="mb-5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          Showing the first {MAX_COMPARE} of {overflow} selected — comparison supports up to {MAX_COMPARE} candidates.
        </p>
      )}
      {mixedAssessments && (
        <p className="mb-5 text-sm text-sky-800 bg-sky-50 border border-sky-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <Icon name="info" className="w-4 h-4 shrink-0" />
          Comparing across different assessments — the radar shows only competencies shared by everyone.
        </p>
      )}

      <div className={`grid gap-4 mb-6 ${headerGrid}`}>
        {candidates.map((c) => {
          const decision = latestDecision.get(c.id);
          return (
            <Card key={c.id} className="p-5 anim-fade-up">
              <div className="flex items-start gap-3">
                <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: colorFor.get(c.id) }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={c.candidate?.full_name || "?"} />
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{c.candidate?.full_name || "Unknown"}</p>
                      <p className="text-xs text-muted truncate">{c.candidate?.email}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted mt-3 truncate">{c.assessments?.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <StatusBadge status={c.status} />
                    {decision ? <StatusBadge status={decision} /> : <span className="text-[11px] text-faint">No decision</span>}
                  </div>
                </div>
                <div className="shrink-0">
                  {c.overall_score !== null ? (
                    <ScoreRing score={Math.round(c.overall_score)} size={72} />
                  ) : (
                    <span className="text-[11px] text-faint text-center block w-[72px]">Not submitted</span>
                  )}
                </div>
              </div>
              <Link
                href={`/staff/candidates/${c.id}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-dark hover:underline"
              >
                Full profile
                <Icon name="arrowRight" className="w-3.5 h-3.5" />
              </Link>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6 items-start">
        <Card className="p-6">
          <p className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Icon name="chart" className="w-4 h-4 text-brand" />
            Competency overlay
          </p>
          {radarLabels.length >= 3 ? (
            <RadarChart labels={radarLabels} series={radarSeries} showLegend />
          ) : (
            <p className="text-sm text-faint py-8 text-center">
              {scored.length < 2
                ? "At least two candidates need scored results before the overlay can be drawn."
                : "These candidates share fewer than three scored competencies, so an overlay wouldn't be meaningful — use the table instead."}
            </p>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="text-faint text-[11px] uppercase tracking-wider border-b border-line">
                <tr>
                  <th className="text-left px-5 py-3.5 font-semibold">Competency</th>
                  {candidates.map((c) => (
                    <th key={c.id} className="text-center px-3 py-3.5 font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: colorFor.get(c.id) }} />
                        {(c.candidate?.full_name || "?").split(/\s+/)[0]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {categories.map((cat) => {
                  const style = categoryStyle(cat);
                  return [
                    <tr key={cat} className="bg-background/60">
                      <td colSpan={cols + 1} className="px-5 py-2">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${style.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          {cat}
                        </span>
                      </td>
                    </tr>,
                    ...(unionByCategory.get(cat) || []).map((name) => {
                      const values = candidates.map((c) => scoreOf(c.id, name));
                      const best = bestOf(values);
                      return (
                        <tr key={`${cat}-${name}`}>
                          <td className="px-5 py-2.5 text-foreground font-medium">{name}</td>
                          {candidates.map((c, i) => {
                            const v = values[i];
                            const isBest = v !== null && best !== null && v === best;
                            return (
                              <td key={c.id} className="px-3 py-2.5 text-center tabular-nums">
                                {v === null ? (
                                  <span className="text-faint">—</span>
                                ) : (
                                  <span className={`inline-block min-w-9 px-1.5 py-0.5 rounded-lg ${isBest ? "bg-accent-soft text-accent-dark font-bold" : "text-muted"}`}>
                                    {Math.round(v)}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    }),
                  ];
                })}
                {categories.length === 0 && (
                  <tr>
                    <td colSpan={cols + 1} className="px-5 py-10 text-center text-faint">
                      No competency scores yet for any selected candidate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          {rollupCats.length > 0 && (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead className="text-faint text-[11px] uppercase tracking-wider border-b border-line">
                  <tr>
                    <th className="text-left px-5 py-3.5 font-semibold">Category average</th>
                    {candidates.map((c) => (
                      <th key={c.id} className="text-center px-3 py-3.5 font-semibold">
                        {(c.candidate?.full_name || "?").split(/\s+/)[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rollupCats.map((cat) => {
                    const values = candidates.map((c) => (rollups.get(c.id) || []).find((g) => g.cat === cat)?.avg ?? null);
                    const best = bestOf(values);
                    const style = categoryStyle(cat);
                    return (
                      <tr key={cat}>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 font-semibold ${style.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            {cat}
                          </span>
                        </td>
                        {values.map((v, i) => {
                          const isBest = v !== null && best !== null && v === best;
                          return (
                            <td key={candidates[i].id} className="px-3 py-3 text-center tabular-nums">
                              {v === null ? (
                                <span className="text-faint">—</span>
                              ) : (
                                <span className={`inline-block min-w-9 px-1.5 py-0.5 rounded-lg ${isBest ? "bg-accent-soft text-accent-dark font-bold" : "text-muted"}`}>
                                  {v}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
