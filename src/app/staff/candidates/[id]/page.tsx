import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { submitReview, deleteProctoringRecording } from "./actions";
import { assignDecisionMaker, unassignDecisionMaker } from "../../people/actions";
import { Avatar, BenchmarkCard, Card, ExecutiveSummaryCard, Icon, ScoreRing, ScoringDisclosure, StatusBadge, bandFor, categoryStyle } from "@/components/ui";
import { RadarChart } from "@/components/charts";
import { PrintButton } from "@/components/print-button";
import { buildExecutiveSummary, categoryRollups, computeBenchmark, potentialFromCompetencies, talentBoxFor } from "@/lib/reporting";
import { DECISION_OPTIONS, PURPOSE_META, normalizePurpose } from "@/lib/purpose";

export default async function CandidateReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select(
      "id, assessment_id, status, overall_score, invited_at, started_at, submitted_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email), assessments(title, description, purpose)"
    )
    .eq("id", id)
    .single();

  if (!ca) notFound();

  const candidate = ca.candidate as unknown as { full_name: string; email: string };
  const assessment = ca.assessments as unknown as { title: string; description: string; purpose: string | null };
  const purpose = normalizePurpose(assessment?.purpose);
  const purposeMeta = PURPOSE_META[purpose];
  const decisionOptions = DECISION_OPTIONS[purpose];

  const { data: peerScoresRaw } = await supabase
    .from("candidate_assessments")
    .select("id, overall_score")
    .eq("assessment_id", ca.assessment_id)
    .not("overall_score", "is", null);

  const [{ data: competencyScores }, { data: responses }, { data: reviews }, { data: allDecisionMakers }, { data: assignedDMs }] = await Promise.all([
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
    supabase.from("profiles").select("id, full_name, email").eq("role", "decision_maker").order("full_name"),
    supabase
      .from("candidate_decision_makers")
      .select("profile_id, profiles(full_name, email)")
      .eq("candidate_assessment_id", id),
  ]);

  const { data: recordings } = await supabase
    .from("proctoring_recordings")
    .select("id, storage_path, consent_given_at, duration_seconds, created_at")
    .eq("candidate_assessment_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const recordingsWithUrls = await Promise.all(
    (recordings || []).map(async (r) => {
      let url: string | null = null;
      if (r.storage_path) {
        const { data: signed } = await supabase.storage.from("proctoring").createSignedUrl(r.storage_path, 3600);
        url = signed?.signedUrl || null;
      }
      return { ...r, url };
    })
  );

  const assignedIds = new Set((assignedDMs || []).map((a) => a.profile_id));
  const unassignedDMs = (allDecisionMakers || []).filter((dm) => !assignedIds.has(dm.id));
  const assignDMWithId = assignDecisionMaker.bind(null, id);

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
        href="/staff/candidates"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-5 font-medium no-print"
      >
        <Icon name="arrowLeft" className="w-4 h-4" />
        All candidates
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
          <ScoringDisclosure className="mb-6 no-print" />
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

          <BenchmarkCard
            benchmark={benchmark}
            assessmentTitle={assessment?.title}
            boxLabel={boxLabel}
            boxHref="/staff/talent-matrix"
          />

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

      {/* Proctoring recordings */}
      {recordingsWithUrls.length > 0 && (
        <Card className="p-6 mb-6 no-print">
          <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
            <Icon name="video" className="w-4 h-4 text-brand" />
            Proctoring recordings
          </p>
          <p className="text-xs text-muted mb-4">Consent-gated video captured during the assessment session.</p>
          <div className="space-y-3">
            {recordingsWithUrls.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 border border-line rounded-xl px-4 py-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-foreground">
                    {r.consent_given_at ? new Date(r.consent_given_at).toLocaleString() : "Unknown time"} ·{" "}
                    {r.duration_seconds ? `${Math.round(r.duration_seconds / 60)} min` : "—"}
                  </p>
                  <p className="text-xs text-faint">
                    {r.url ? "Stored in project database" : "Recorded on candidate's device only — not uploaded"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.url && (
                    <>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                      >
                        <Icon name="play" className="w-3.5 h-3.5" />
                        Watch
                      </a>
                      <a
                        href={r.url}
                        download
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                      >
                        <Icon name="download" className="w-3.5 h-3.5" />
                        Download
                      </a>
                    </>
                  )}
                  <form action={deleteProctoringRecording.bind(null, id, r.id, r.storage_path)}>
                    <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-critical hover:underline">
                      <Icon name="trash" className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Decision makers */}
      <Card className="p-6 mb-6 no-print">
        <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
          <Icon name="shield" className="w-4 h-4 text-brand" />
          Decision makers
        </p>
        <p className="text-xs text-muted mb-4">
          Give specific stakeholders access to review this candidate and submit a decision, alongside HR. Add new
          people from People &amp; Access.
        </p>

        {(assignedDMs || []).length > 0 && (
          <div className="space-y-2 mb-4">
            {(assignedDMs as unknown as { profile_id: string; profiles: { full_name: string; email: string } | null }[]).map((a) => (
              <div key={a.profile_id} className="flex items-center justify-between gap-3 text-sm border border-line rounded-xl px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{a.profiles?.full_name}</p>
                  <p className="text-xs text-muted truncate">{a.profiles?.email}</p>
                </div>
                <form action={unassignDecisionMaker.bind(null, id, a.profile_id)}>
                  <button className="text-xs text-critical hover:underline shrink-0">Remove</button>
                </form>
              </div>
            ))}
          </div>
        )}

        {unassignedDMs.length > 0 ? (
          <form action={assignDMWithId} className="flex gap-2">
            <select
              name="decision_maker_id"
              required
              className="flex-1 min-w-0 bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {unassignedDMs.map((dm) => (
                <option key={dm.id} value={dm.id}>
                  {dm.full_name} — {dm.email}
                </option>
              ))}
            </select>
            <button className="bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-light transition-colors shrink-0">
              Assign
            </button>
          </form>
        ) : (
          <p className="text-xs text-faint">
            {(allDecisionMakers || []).length === 0
              ? "No decision makers yet — add one from People & Access."
              : "All decision makers are already assigned to this candidate."}
          </p>
        )}
      </Card>

      {/* Decision */}
      <Card className="p-6">
        <p className="text-sm font-bold text-foreground mb-1">{purposeMeta.reviewerTitle}</p>
        <p className="text-xs text-muted mb-5">{purposeMeta.blurb}</p>
        <form action={submitReviewWithId} className="space-y-3.5 no-print">
          <div className={`grid gap-2.5 ${decisionOptions.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {decisionOptions.map((d) => (
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
          <button className="inline-flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-light transition-colors">
            <Icon name="send" className="w-4 h-4" />
            Submit decision
          </button>
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
