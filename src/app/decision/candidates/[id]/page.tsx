import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { submitReview } from "./actions";
import { Avatar, BenchmarkCard, Card, ExecutiveSummaryCard, Icon, ScoreRing, StatusBadge, bandFor, categoryStyle } from "@/components/ui";
import { RadarChart } from "@/components/charts";
import { PrintButton } from "@/components/print-button";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { buildExecutiveSummary, categoryRollups, computeBenchmark, potentialFromCompetencies, talentBoxFor } from "@/lib/reporting";

export default async function CandidateReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select(
      "id, assessment_id, status, overall_score, invited_at, started_at, submitted_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email), assessments(title, description)"
    )
    .eq("id", id)
    .single();

  if (!ca) notFound();

  const candidate = ca.candidate as unknown as { full_name: string; email: string };
  const assessment = ca.assessments as unknown as { title: string; description: string };

  const { data: peerScoresRaw } = await supabase
    .from("candidate_assessments")
    .select("id, overall_score")
    .eq("assessment_id", ca.assessment_id)
    .not("overall_score", "is", null);

  const [{ data: competencyScores }, { data: responses }, { data: reviews }] = await Promise.all([
    supabase
      .from("candidate_competency_scores")
      .select("score, level, competencies(name, category)")
      .eq("candidate_assessment_id", id),
    supabase
      .from("candidate_responses")
      .select("response_text, selected_option, score, ai_rationale, questions(prompt, question_type, options, competencies(name))")
      .eq("candidate_assessment_id", id),
    supabase
      .from("candidate_reviews")
      .select("decision, comment, created_at, reviewer:profiles!candidate_reviews_reviewer_id_fkey(full_name)")
      .eq("candidate_assessment_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const scores = ((competencyScores || []) as unknown as {
    score: number;
    level: string;
    competencies: { name: string; category: string } | null;
  }[])
    .filter((s) => s.competencies)
    .sort((a, b) => b.score - a.score);

  const competencyLines = scores.map((s) => ({
    name: s.competencies!.name,
    category: s.competencies!.category,
    score: s.score,
    level: s.level,
  }));
  const byCategory = categoryRollups(competencyLines);

  const peerScores = ((peerScoresRaw || []) as { id: string; overall_score: number }[]).map((p) => p.overall_score);
  const benchmark = computeBenchmark(ca.overall_score, peerScores);

  let boxLabel: string | null = null;
  if (ca.overall_score !== null && competencyLines.length > 0) {
    const { potential } = potentialFromCompetencies(ca.overall_score, competencyLines);
    boxLabel = talentBoxFor(ca.overall_score, potential).label;
  }

  const executiveSummary =
    ca.overall_score !== null && competencyLines.length > 0
      ? buildExecutiveSummary({
          candidateName: candidate?.full_name || "This candidate",
          overallScore: ca.overall_score,
          competencies: competencyLines,
          benchmark,
          boxLabel,
        })
      : null;

  const submitReviewWithId = submitReview.bind(null, id);

  return (
    <div className="p-6 lg:p-10 max-w-5xl print-page">
      <Link
        href="/decision"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-5 font-medium no-print"
      >
        <Icon name="arrowLeft" className="w-4 h-4" />
        All assigned candidates
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-5 mb-8">
        <div className="flex items-center gap-4">
          <Avatar name={candidate?.full_name || "?"} className="w-14 h-14 text-lg" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground [font-family:var(--font-display)]">
              {candidate?.full_name}
            </h1>
            <p className="text-sm text-muted">{candidate?.email}</p>
            <p className="text-[13px] text-muted mt-1.5 flex flex-wrap items-center gap-2">
              {assessment?.title}
              <StatusBadge status={ca.status} />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          <a
            href={`/report/${id}/pdf`}
            className="inline-flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-light transition-colors"
          >
            <Icon name="download" className="w-4 h-4" />
            Download PDF
          </a>
          <PrintButton />
        </div>
      </div>

      {ca.overall_score !== null ? (
        <>
          {executiveSummary && <ExecutiveSummaryCard summary={executiveSummary} />}

          {/* Score + radar */}
          <div className="grid md:grid-cols-[auto_1fr] gap-5 mb-6">
            <Card className="p-7 flex flex-col items-center justify-center gap-2 min-w-56">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-faint">Overall Role Fit</p>
              <ScoreRing score={Math.round(ca.overall_score)} size={128} label={bandFor(ca.overall_score).label} />
              <p className="text-[11px] text-faint text-center max-w-44 mt-1">
                Weighted average across mapped competencies · AI-assisted, human-confirmed
              </p>
            </Card>
            <Card className="p-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-faint mb-3">Competency radar</p>
              {scores.length >= 3 ? (
                <RadarChart items={scores.slice(0, 8).map((s) => ({ label: s.competencies!.name, value: Math.round(s.score) }))} />
              ) : (
                <p className="text-sm text-muted py-8 text-center">Radar view needs at least three scored competencies.</p>
              )}
            </Card>
          </div>

          <BenchmarkCard benchmark={benchmark} assessmentTitle={assessment?.title} boxLabel={boxLabel} />

          {/* Competency bars by category */}
          {byCategory.map(({ cat, rows, avg }) => {
            const style = categoryStyle(cat);
            return (
              <Card key={cat} className="p-6 mb-5">
                <p className="flex items-center gap-2 text-sm font-bold text-foreground mb-5">
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                  {cat} competencies
                  {avg !== null && <span className="ml-auto text-xs font-bold text-muted tabular-nums">avg {avg}</span>}
                </p>
                <div className="space-y-4">
                  {rows.map((s, i) => {
                    const b = bandFor(s.score);
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-[13px] mb-1.5">
                          <span className="font-medium text-foreground">{s.name}</span>
                          <span className="flex items-center gap-2.5">
                            <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${b.badge}`}>
                              {s.level}
                            </span>
                            <span className="font-bold tabular-nums w-8 text-right">{Math.round(s.score)}</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-line/70 overflow-hidden">
                          <div className="h-full rounded-full anim-grow" style={{ width: `${s.score}%`, background: style.hex }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </>
      ) : (
        <Card className="p-6 mb-6 flex items-center gap-3 text-sm text-amber-800 bg-amber-50 border-amber-200">
          <Icon name="clock" className="w-5 h-5 shrink-0" />
          Candidate has not yet submitted this assessment — scores will appear here once they do.
        </Card>
      )}

      {/* Response evidence */}
      {responses && responses.length > 0 && (
        <Card className="p-6 mb-6">
          <p className="text-sm font-bold text-foreground mb-1">Response evidence</p>
          <p className="text-xs text-muted mb-6">Each answer with its AI-assigned score and written rationale.</p>
          <div className="space-y-6">
            {(responses as unknown as {
              response_text: string | null;
              selected_option: string | null;
              score: number;
              ai_rationale: string;
              questions: {
                prompt: string;
                question_type: string;
                options: { key: string; text: string }[] | null;
                competencies: { name: string } | null;
              } | null;
            }[]).map((r, i) => {
              const b = bandFor(r.score);
              return (
                <div key={i} className="border border-line rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
                    <div>
                      {r.questions?.competencies?.name && (
                        <p className="text-[10.5px] font-bold uppercase tracking-wider text-accent-dark mb-1">
                          {r.questions.competencies.name}
                        </p>
                      )}
                      <p className="text-sm font-semibold text-foreground">{r.questions?.prompt}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ring-1 ring-inset tabular-nums shrink-0 ${b.badge}`}>
                      {r.score}
                    </span>
                  </div>
                  {r.response_text ? (
                    <blockquote className="text-sm text-muted italic bg-background border-l-2 border-accent rounded-r-lg px-4 py-3 mb-3">
                      “{r.response_text}”
                    </blockquote>
                  ) : (
                    <p className="text-sm text-muted mb-3">
                      Selected:{" "}
                      <span className="font-semibold text-foreground">
                        {r.selected_option}. {r.questions?.options?.find((o) => o.key === r.selected_option)?.text ?? "—"}
                      </span>
                    </p>
                  )}
                  <p className="text-xs text-faint leading-relaxed flex items-start gap-2">
                    <Icon name="wand" className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent-dark" />
                    {r.ai_rationale}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Decision */}
      <Card className="p-6">
        <p className="text-sm font-bold text-foreground mb-1">Your decision</p>
        <p className="text-xs text-muted mb-5">
          Submit your assessment of this candidate. HR and other assigned decision makers will see it alongside theirs.
        </p>
        <form action={submitReviewWithId} className="space-y-3.5 no-print">
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { v: "shortlist", label: "Shortlist", icon: "checkCircle", cls: "peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:text-emerald-700" },
              { v: "hold", label: "Hold", icon: "clock", cls: "peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-checked:text-amber-700" },
              { v: "reject", label: "Reject", icon: "x", cls: "peer-checked:border-red-500 peer-checked:bg-red-50 peer-checked:text-red-700" },
            ].map((d) => (
              <label key={d.v} className="cursor-pointer">
                <input type="radio" name="decision" value={d.v} required className="peer sr-only" />
                <span
                  className={`flex items-center justify-center gap-2 border border-line rounded-xl px-3 py-3 text-sm font-semibold text-muted transition-colors hover:border-faint ${d.cls}`}
                >
                  <Icon name={d.icon} className="w-4 h-4" />
                  {d.label}
                </span>
              </label>
            ))}
          </div>
          <textarea
            name="comment"
            rows={3}
            placeholder="Reviewer notes — what stood out, what to probe in interview…"
            className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <ConfirmSubmitButton
            confirmMessage="Submit your decision for this candidate?"
            icon="send"
            className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-light transition-colors"
          >
            Submit decision
          </ConfirmSubmitButton>
        </form>

        {reviews && reviews.length > 0 && (
          <div className="mt-6 space-y-3 border-t border-line pt-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Decision history</p>
            {(reviews as unknown as { decision: string; comment: string; created_at: string; reviewer: { full_name: string } | null }[]).map(
              (r, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <StatusBadge status={r.decision} />
                  <p className="text-muted">
                    <span className="font-semibold text-foreground">{r.reviewer?.full_name}</span>
                    {r.comment ? ` — “${r.comment}”` : ""}
                    <span className="text-faint text-xs"> · {new Date(r.created_at).toLocaleString()}</span>
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
