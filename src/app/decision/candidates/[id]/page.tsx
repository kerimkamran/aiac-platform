import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { submitReview } from "./actions";
import { Avatar, BenchmarkCard, Card, ExecutiveSummaryCard, Icon, ScoreRing, ScoringDisclosure, StatusBadge, bandFor, categoryStyle } from "@/components/ui";
import { RadarChart } from "@/components/charts";
import { PrintButton } from "@/components/print-button";
import { ReportChatPanel } from "@/components/ReportChatPanel";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { buildExecutiveSummary, categoryRollups, computeBenchmark, potentialFromCompetencies, talentBoxFor } from "@/lib/reporting";
import { DECISION_OPTIONS, PURPOSE_META, normalizePurpose } from "@/lib/purpose";

export default async function CandidateReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select(
      "id, assessment_id, status, overall_score, invited_at, started_at, submitted_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email), assessments(title, description, purpose, content_language)"
    )
    .eq("id", id)
    .single();

  if (!ca) notFound();

  const candidate = ca.candidate as unknown as { full_name: string; email: string };
  const assessment = ca.assessments as unknown as {
    title: string;
    description: string;
    purpose: string | null;
    content_language: string | null;
  };
  const purpose = normalizePurpose(assessment?.purpose);
  const purposeMeta = PURPOSE_META[purpose];
  const decisionOptions = DECISION_OPTIONS[purpose];
  // Design-execution-plan Phase 2 / T2.5: see the same note in
  // staff/reports/candidates/[id]/page.tsx -- ai_rationale is deliberately
  // excluded, it's always English by design (scoring.ts's system prompt).
  const contentLangAttr =
    assessment?.content_language && assessment.content_language !== "en" ? { lang: assessment.content_language } : {};

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
      .select("response_text, selected_option, score, ai_rationale, needs_review, questions(prompt, question_type, options, competencies(name))")
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

  // Design-execution-plan Phase 5 / T5.1: see the matching note in
  // staff/reports/candidates/[id]/page.tsx -- same restructure, same reasons.
  const responseRows = (responses || []) as unknown as {
    response_text: string | null;
    selected_option: string | null;
    score: number;
    ai_rationale: string;
    needs_review: boolean | null;
    questions: {
      prompt: string;
      question_type: string;
      options: { key: string; text: string }[] | null;
      competencies: { name: string } | null;
    } | null;
  }[];
  const needsReviewCount = responseRows.filter((r) => r.needs_review).length;
  const topCompetencies = competencyLines.slice(0, 5);

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
          purpose,
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
            <p className="text-xs text-muted mt-1.5 flex flex-wrap items-center gap-2">
              {assessment?.title}
              <StatusBadge status={ca.status} />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          <ReportChatPanel candidateAssessmentId={id} candidateName={candidate?.full_name || "This candidate"} />
          <a
            href={`/report/${id}/pdf`}
            className="inline-flex items-center gap-2 bg-brand-deep text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand transition-colors"
          >
            <Icon name="download" className="w-4 h-4" />
            Download PDF
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Design-execution-plan Phase 5 / T5.1: evidence, then the AI's
          contribution, then the human decision -- see the matching note in
          staff/reports/candidates/[id]/page.tsx for the full rationale. */}

      {ca.overall_score !== null && <ScoringDisclosure className="mb-6 no-print" />}

      {needsReviewCount > 0 && (
        <Card className="p-5 mb-6 flex items-start gap-3 bg-amber-50 border-amber-200 no-print">
          <Icon name="alertTriangle" className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {needsReviewCount} response{needsReviewCount === 1 ? "" : "s"} flagged for review
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              The scoring engine wasn&apos;t confident in {needsReviewCount === 1 ? "this score" : "these scores"} — check
              the flagged answer{needsReviewCount === 1 ? "" : "s"} in Response evidence below before relying on{" "}
              {needsReviewCount === 1 ? "it" : "them"}.
            </p>
          </div>
        </Card>
      )}

      {/* ---------- Evidence ---------- */}
      {responseRows.length > 0 && (
        <Card className="p-6 mb-6">
          <p className="text-sm font-bold text-foreground mb-1">Response evidence</p>
          <p className="text-xs text-muted mb-6">
            What the candidate actually answered, with the AI&apos;s score and rationale for each — read this before the
            summary below.
          </p>
          <div className="space-y-6">
            {responseRows.map((r, i) => {
              const b = bandFor(r.score);
              return (
                <div key={i} className="border border-line rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
                    <div>
                      {r.questions?.competencies?.name && (
                        <p className="text-2xs font-bold uppercase tracking-wider text-accent-dark mb-1">
                          {r.questions.competencies.name}
                        </p>
                      )}
                      <p className="text-sm font-semibold text-foreground" {...contentLangAttr}>
                        {r.questions?.prompt}
                      </p>
                    </div>
                    <span className="flex items-center gap-2 shrink-0">
                      {r.needs_review && (
                        <span
                          className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
                          title="The scoring engine wasn't confident in this score -- confirm it yourself before relying on it."
                        >
                          <Icon name="alertTriangle" className="w-3 h-3" />
                          Needs review
                        </span>
                      )}
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ring-1 ring-inset tabular-nums ${b.badge}`}>
                        {r.score}
                      </span>
                    </span>
                  </div>
                  {r.response_text ? (
                    <blockquote
                      className="text-sm text-muted italic bg-background border-l-2 border-accent rounded-r-lg px-4 py-3 mb-3"
                      {...contentLangAttr}
                    >
                      “{r.response_text}”
                    </blockquote>
                  ) : (
                    <p className="text-sm text-muted mb-3">
                      Selected:{" "}
                      <span className="font-semibold text-foreground" {...contentLangAttr}>
                        {r.selected_option}. {r.questions?.options?.find((o) => o.key === r.selected_option)?.text ?? "—"}
                      </span>
                    </p>
                  )}
                  <p className="text-xs text-muted leading-relaxed flex items-start gap-2">
                    <Icon name="wand" className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent-dark" />
                    {r.ai_rationale}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ---------- The AI's contribution ---------- */}
      {ca.overall_score !== null ? (
        <>
          {executiveSummary && <ExecutiveSummaryCard summary={executiveSummary} />}

          {/* T5.1 (radar demotion, confirmed): sorted bar list is the
              primary at-a-glance read, not the radar -- see the collapsed
              Competency radar card further down. */}
          <div className="grid md:grid-cols-[auto_1fr] gap-5 mb-6">
            <Card className="p-7 flex flex-col items-center justify-center gap-2 min-w-56">
              <p className="text-2xs font-bold uppercase tracking-[0.16em] text-muted">Overall Role Fit</p>
              <ScoreRing score={Math.round(ca.overall_score)} size={128} label={bandFor(ca.overall_score).label} />
              <p className="text-2xs text-muted text-center max-w-44 mt-1">
                Weighted average across mapped competencies · AI-assisted, human-confirmed
              </p>
            </Card>
            <Card className="p-7">
              <p className="text-2xs font-bold uppercase tracking-[0.16em] text-muted mb-4">Top competencies</p>
              {topCompetencies.length > 0 ? (
                <div className="space-y-3.5">
                  {topCompetencies.map((s) => {
                    const style = categoryStyle(s.category);
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-medium text-foreground">{s.name}</span>
                          <span className="font-bold tabular-nums">{Math.round(s.score)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-line/70 overflow-hidden">
                          <div className="h-full rounded-full anim-grow" style={{ width: `${s.score}%`, background: style.hex }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted py-8 text-center">No scored competencies yet.</p>
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
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-medium text-foreground">{s.name}</span>
                          <span className="flex items-center gap-2.5">
                            <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${b.badge}`}>
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

          {/* T3.5 (confirmed at Phase 5): demoted to a collapsed secondary
              view -- see the same note in the staff report page. */}
          {scores.length >= 3 && (
            <Card className="p-6 mb-5">
              <details>
                <summary className="text-sm font-bold text-foreground cursor-pointer select-none">
                  Competency radar (supporting view)
                </summary>
                <div className="mt-4 max-w-md mx-auto">
                  <RadarChart items={scores.slice(0, 8).map((s) => ({ label: s.competencies!.name, value: Math.round(s.score) }))} />
                </div>
              </details>
            </Card>
          )}
        </>
      ) : (
        <Card className="p-6 mb-6 flex items-center gap-3 text-sm text-amber-800 bg-amber-50 border-amber-200">
          <Icon name="clock" className="w-5 h-5 shrink-0" />
          Candidate has not yet submitted this assessment — scores will appear here once they do.
        </Card>
      )}

      {/* ---------- The human decision ---------- */}
      {/* Decision */}
      <Card className="p-6">
        <p className="text-sm font-bold text-foreground mb-1">Your decision</p>
        <p className="text-xs text-muted mb-5">
          {purposeMeta.blurb} {purpose === "hiring" ? "HR and other assigned decision makers will see it alongside theirs." : ""}
        </p>
        <form action={submitReviewWithId} className="space-y-3.5 no-print">
          <div className={`grid gap-2.5 ${decisionOptions.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {decisionOptions.map((d) => (
              <label key={d.v} className="cursor-pointer">
                <input type="radio" name="decision" value={d.v} required className="peer sr-only" />
                <span
                  className={`flex items-center justify-center gap-2 border border-line rounded-xl px-3 py-3 text-sm font-semibold text-muted transition-colors hover:border-line-strong ${d.cls}`}
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
            className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <ConfirmSubmitButton
            confirmMessage="Submit your decision for this candidate?"
            icon="send"
            className="bg-brand-deep text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand transition-colors"
          >
            Submit decision
          </ConfirmSubmitButton>
        </form>

        {reviews && reviews.length > 0 && (
          <div className="mt-6 space-y-3 border-t border-line pt-5">
            <p className="text-2xs font-bold uppercase tracking-wider text-muted">Decision history</p>
            {(reviews as unknown as { decision: string; comment: string; created_at: string; reviewer: { full_name: string } | null }[]).map(
              (r, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <StatusBadge status={r.decision} />
                  <p className="text-muted">
                    <span className="font-semibold text-foreground">{r.reviewer?.full_name}</span>
                    {r.comment ? ` — “${r.comment}”` : ""}
                    <span className="text-muted text-xs"> · {new Date(r.created_at).toLocaleString()}</span>
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
