import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Icon, PageHeader, ScoreRing, bandFor, categoryStyle } from "@/components/ui";
import { RadarChart } from "@/components/charts";

export default async function CandidateResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select("id, status, overall_score, candidate_id, submitted_at, assessments(title, description)")
    .eq("id", id)
    .single();

  if (!ca || ca.candidate_id !== user!.id) redirect("/candidate/results");
  if (ca.status !== "reviewed" || ca.overall_score === null) redirect("/candidate/results");

  const { data: scores } = await supabase
    .from("candidate_competency_scores")
    .select("score, level, competencies(name, category)")
    .eq("candidate_assessment_id", id);

  const items = ((scores || []) as unknown as { score: number; level: string; competencies: { name: string; category: string } | null }[])
    .filter((s) => s.competencies)
    .sort((a, b) => b.score - a.score);

  const meta = ca.assessments as unknown as { title: string; description: string };
  const band = bandFor(ca.overall_score);
  const byCategory = ["Core", "Leadership", "Functional"]
    .map((cat) => ({ cat, rows: items.filter((i) => i.competencies!.category === cat) }))
    .filter((g) => g.rows.length > 0);
  const strongest = items[0];

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <Link href="/candidate/results" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-5 font-medium">
        <Icon name="arrowLeft" className="w-4 h-4" />
        All results
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
        <PageHeader title={meta?.title || "Result"} subtitle="Your reviewed competency profile for this assessment." />
        <a
          href={`/report/${id}/pdf`}
          className="inline-flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-light transition-colors shrink-0"
        >
          <Icon name="download" className="w-4 h-4" />
          Download PDF
        </a>
      </div>

      <div className="grid md:grid-cols-[auto_1fr] gap-5 mb-6">
        <Card className="p-7 flex flex-col items-center justify-center gap-2 min-w-56">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-faint">Overall Role Fit</p>
          <ScoreRing score={Math.round(ca.overall_score)} size={128} label={band.label} />
        </Card>
        <Card className="p-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-faint mb-4">Competency radar</p>
          {items.length >= 3 ? (
            <RadarChart items={items.slice(0, 8).map((i) => ({ label: i.competencies!.name, value: Math.round(i.score) }))} />
          ) : (
            <p className="text-sm text-muted">Radar view needs at least three scored competencies.</p>
          )}
        </Card>
      </div>

      {strongest && (
        <Card className="p-5 mb-6 flex items-start gap-4">
          <span className="w-10 h-10 rounded-xl bg-accent-soft text-accent-dark grid place-items-center shrink-0">
            <Icon name="award" className="w-5 h-5" />
          </span>
          <p className="text-sm text-muted leading-relaxed self-center">
            Your strongest area was{" "}
            <span className="font-semibold text-foreground">{strongest.competencies!.name}</span> at{" "}
            <span className="font-semibold text-foreground tabular-nums">{Math.round(strongest.score)}</span> —{" "}
            {bandFor(strongest.score).label}.
          </p>
        </Card>
      )}

      {byCategory.map(({ cat, rows }) => {
        const style = categoryStyle(cat);
        return (
          <Card key={cat} className="p-6 mb-5">
            <p className="flex items-center gap-2 text-sm font-bold text-foreground mb-5">
              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              {cat} competencies
            </p>
            <div className="space-y-4">
              {rows.map((r, i) => {
                const b = bandFor(r.score);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-[13px] mb-1.5">
                      <span className="font-medium text-foreground">{r.competencies!.name}</span>
                      <span className="flex items-center gap-2.5">
                        <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${b.badge}`}>{r.level}</span>
                        <span className="font-bold tabular-nums w-8 text-right">{Math.round(r.score)}</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-line/70 overflow-hidden">
                      <div className="h-full rounded-full anim-grow" style={{ width: `${r.score}%`, background: style.hex }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <p className="text-xs text-faint mt-6 max-w-lg">
        Scores are AI-assisted against Azerconnect&apos;s competency behavioural anchors and confirmed by a human
        reviewer. Bands: Exceeds ≥85 · Fully Meets ≥70 · Partially Meets ≥50.
      </p>
    </div>
  );
}
