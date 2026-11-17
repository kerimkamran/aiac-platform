import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Icon, PageHeader, ScoreRing, bandFor, bandLabelFor, categoryStyle } from "@/components/ui";
import { RadarChart } from "@/components/charts";
import { buildDevelopmentFeedback } from "@/lib/reporting";
import { buttonClass } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { getT } from "@/i18n/server";
import { fillNodes } from "@/lib/fill-nodes";
import { fillText } from "@/lib/dates";

export default async function CandidateResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getT();
  const w = t.candidate.detail;
  const bands = t.candidate.bands;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select("id, status, overall_score, candidate_id, submitted_at, feedback_released_at, assessments(title, description)")
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
  const byCategory = ["Core", "Leadership", "Functional"]
    .map((cat) => ({ cat, rows: items.filter((i) => i.competencies!.category === cat) }))
    .filter((g) => g.rows.length > 0);
  const strongest = items[0];

  const feedback = ca.feedback_released_at
    ? buildDevelopmentFeedback(
        items.map((i) => ({
          name: i.competencies!.name,
          category: i.competencies!.category,
          score: i.score,
          level: i.level,
        })),
        { strength: w.strengthBlurb, growth: w.growthBlurb }
      )
    : null;

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <Link href="/candidate/results" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-5 font-medium">
        <Icon name="arrowLeft" className="w-4 h-4" />
        {w.back}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
        <PageHeader title={meta?.title || w.resultFallback} subtitle={w.subtitle} />
        <a
          href={`/report/${id}/pdf`}
          className={buttonClass({ size: "md", className: "shrink-0" })}
        >
          <Icon name="download" className="w-4 h-4" />
          {w.download}
        </a>
      </div>

      <Callout tone="info" className="mb-6">
        {w.howNote}
      </Callout>

      <div className="grid md:grid-cols-[auto_1fr] gap-5 mb-6">
        <Card className="p-7 flex flex-col items-center justify-center gap-2 min-w-56">
          <p className="text-sm font-semibold text-muted">{w.overall}</p>
          <ScoreRing score={Math.round(ca.overall_score)} size={128} label={bandLabelFor(ca.overall_score, bands)} />
        </Card>
        <Card className="p-7">
          <p className="text-sm font-semibold text-muted mb-4">{w.radar}</p>
          {items.length >= 3 ? (
            <RadarChart items={items.slice(0, 8).map((i) => ({ label: i.competencies!.name, value: Math.round(i.score) }))} />
          ) : (
            <p className="text-sm text-muted">{w.radarNeeds}</p>
          )}
        </Card>
      </div>

      {strongest && (
        <Card className="p-5 mb-6 flex items-start gap-4">
          <span className="w-10 h-10 rounded-xl bg-accent-soft text-accent-dark grid place-items-center shrink-0">
            <Icon name="award" className="w-5 h-5" />
          </span>
          <p className="text-sm text-muted leading-relaxed self-center">
            {fillNodes(w.strongest, {
              name: <span className="font-semibold text-foreground">{strongest.competencies!.name}</span>,
              score: <span className="font-semibold text-foreground tabular-nums">{Math.round(strongest.score)}</span>,
              band: bandLabelFor(strongest.score, bands),
            })}
          </p>
        </Card>
      )}

      {feedback && (
        <Card className="p-6 mb-6">
          <p className="flex items-center gap-2 text-sm font-bold text-foreground mb-1">
            <Icon name="wand" className="w-4 h-4 text-accent-dark" />
            {w.devTitle}
          </p>
          <p className="text-xs text-muted mb-5">
            {w.devNote}
          </p>
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <p className="text-sm font-semibold text-muted mb-3">{w.strengthsTitle}</p>
              <div className="space-y-3">
                {feedback.strengths.map((s) => (
                  <div key={s.name} className="border border-line rounded-xl p-4">
                    <p className="text-sm font-semibold text-foreground mb-1">
                      {s.name} <span className="text-muted font-normal tabular-nums">· {s.score}</span>
                    </p>
                    <p className="text-xs text-muted leading-relaxed">{s.blurb}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted mb-3">{w.growthTitle}</p>
              <div className="space-y-3">
                {feedback.growthAreas.map((g) => (
                  <div key={g.name} className="border border-line rounded-xl p-4">
                    <p className="text-sm font-semibold text-foreground mb-1">
                      {g.name} <span className="text-muted font-normal tabular-nums">· {g.score}</span>
                    </p>
                    <p className="text-xs text-muted leading-relaxed">{g.blurb}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {byCategory.map(({ cat, rows }) => {
        const style = categoryStyle(cat);
        return (
          <Card key={cat} className="p-6 mb-5">
            <p className="flex items-center gap-2 text-sm font-bold text-foreground mb-5">
              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              {fillText(w.categoryTitle, { category: (w.categories as Record<string, string>)[cat] ?? cat })}
            </p>
            <div className="space-y-4">
              {rows.map((r, i) => {
                const b = bandFor(r.score);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-foreground">{r.competencies!.name}</span>
                      <span className="flex items-center gap-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${b.badge}`}>{r.level}</span>
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

      <p className="text-xs text-muted mt-6 max-w-lg">
        {fillText(w.footnote, { exceeds: bands.exceeds, fully: bands.fullyMeets, partially: bands.partiallyMeets })}
      </p>
    </div>
  );
}
