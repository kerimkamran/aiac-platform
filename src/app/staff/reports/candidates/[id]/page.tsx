import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { submitReview, deleteProctoringRecording, requestManagerSignoff, releaseFeedback, setExtraTime, setDeadline, reviewAnswer, tellCandidateReviewed } from "./actions";
import { ExtraTimeCard } from "@/components/ExtraTimeCard";
import { Avatar, BenchmarkCard, Card, ExecutiveSummaryCard, Icon, ProgressBar, ScoreRing, ScoringDisclosure, StatusBadge, bandFor, categoryStyle } from "@/components/ui";
import { checkNonsense } from "@/lib/nonsense";
import { isUnreadByAi, readableRationale } from "@/lib/scoring";
import { RadarChart } from "@/components/charts";
import { PrintButton } from "@/components/print-button";
import { buildExecutiveSummary, categoryRollups, computeBenchmark, potentialFromCompetencies, talentBoxFor } from "@/lib/reporting";
import { DECISION_OPTIONS, PURPOSE_META, normalizePurpose } from "@/lib/purpose";
import { orgToday } from "@/lib/deadline";
import { Callout } from "@/components/ui/Callout";
import { buttonClass } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { nowMs } from "@/lib/time";
import { getT } from "@/i18n/server";
import { fillNodes } from "@/lib/fill-nodes";
import { fillText, pluralText } from "@/lib/dates";
import { bandLabelFor } from "@/components/ui";

const LOCALE = { en: "en-GB", az: "az-Latn-AZ", ru: "ru-RU" } as const;

export default async function CandidateReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ decided?: string; told?: string; conflictBy?: string; conflictAs?: string; conflictDecision?: string; conflictComment?: string }>;
}) {
  const { id } = await params;
  const { decided, told, conflictBy, conflictAs, conflictDecision, conflictComment } = await searchParams;
  // STF-B-12: stamped now, sent back unchanged by the decision form, so the
  // server action can tell whether someone else decided after this render.
  const loadedAtMs = nowMs();
  const supabase = await createClient();
  const { lang, t: dict } = await getT();
  const t = dict.staff.report;
  const locale = LOCALE[lang];
  const statusLabels = { ...dict.staff.status, ...dict.staff.statusMore };
  const decisionWord = (v: string) => (dict.staff.decisions as Record<string, string>)[v] ?? v.replace(/_/g, " ");

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const { data: viewerProfile } = viewer
    ? await supabase.from("profiles").select("role").eq("id", viewer.id).maybeSingle()
    : { data: null };
  const viewerIsAdmin = !!viewerProfile && ["hr_admin", "system_admin"].includes(viewerProfile.role);

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select(
      "id, assessment_id, candidate_id, status, overall_score, invited_at, started_at, submitted_at, feedback_released_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email, manager_id), assessments(title, description, purpose, content_language)"
    )
    .eq("id", id)
    .single();

  if (!ca) notFound();

  const candidate = ca.candidate as unknown as { full_name: string; email: string; manager_id: string | null };
  const assessment = ca.assessments as unknown as {
    title: string;
    description: string;
    purpose: string | null;
    content_language: string | null;
  };
  const purpose = normalizePurpose(assessment?.purpose);
  const purposeMeta = { ...PURPOSE_META[purpose], reviewerTitle: dict.staff.purpose[purpose].title, blurb: dict.staff.purpose[purpose].blurb };
  const decisionOptions = DECISION_OPTIONS[purpose].map((o) => ({ ...o, label: decisionWord(o.v) }));
  const isOwnAssessment = !!viewer && ca.candidate_id === viewer.id;
  const canDecide = !isOwnAssessment && ["submitted", "scored", "reviewed"].includes(ca.status);
  // Design-execution-plan Phase 2 / T2.5: the question prompt/options and the
  // candidate's own answer below are in the assessment's content language
  // (Azerbaijani/Russian assessments exist); ai_rationale stays English by
  // design (see scoring.ts's system prompt) since it's written for this
  // English-language report, so it's deliberately not included here.
  const contentLangAttr =
    assessment?.content_language && assessment.content_language !== "en" ? { lang: assessment.content_language } : {};

  const { data: peerScoresRaw } = await supabase
    .from("candidate_assessments")
    .select("id, overall_score")
    .eq("assessment_id", ca.assessment_id)
    .not("overall_score", "is", null);

  // Role-profile bar: per-competency target levels set on this assessment's
  // sections in the Builder. Competencies without a target are unaffected.
  const { data: targetRows } = await supabase
    .from("assessment_sections")
    .select("competency_id, target_score")
    .eq("assessment_id", ca.assessment_id)
    .not("target_score", "is", null);
  const targetByCompetency = new Map<string, number>();
  for (const t of targetRows || []) {
    if (t.competency_id && t.target_score !== null) {
      const existing = targetByCompetency.get(t.competency_id);
      targetByCompetency.set(t.competency_id, existing === undefined ? Number(t.target_score) : Math.max(existing, Number(t.target_score)));
    }
  }

  const [{ data: competencyScores }, { data: responses }, { data: reviews }] = await Promise.all([
    supabase
      .from("candidate_competency_scores")
      .select("score, level, competency_id, competencies(name, category)")
      .eq("candidate_assessment_id", id),
    supabase
      .from("candidate_responses")
      .select("id, response_text, selected_option, score, ai_rationale, needs_review, questions(prompt, question_type, options, competencies(name))")
      .eq("candidate_assessment_id", id)
      // A stable order, so "Answer 3 of 8" and "next answer to check" agree
      // with reviewAnswer()'s own ordering.
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("candidate_reviews")
      .select("decision, comment, created_at, reviewer_id, reviewer:profiles!candidate_reviews_reviewer_id_fkey(full_name)")
      .eq("candidate_assessment_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const { data: recordings } = await supabase
    .from("proctoring_recordings")
    .select("id, storage_path, consent_given_at, duration_seconds, created_at")
    .eq("candidate_assessment_id", id)
    .is("deleted_at", null)
    // Oldest first: an exam is recorded in consecutive parts (Part 1, 2, ...).
    .order("created_at", { ascending: true });

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

  // Promotion-only: lightweight manager sign-off. profiles.manager_id resolves
  // who the employee's manager is; the sign-off itself is a request/response
  // row on promotion_signoffs, not a blocking gate on the HR decision above.
  let managerProfile: { id: string; full_name: string; email: string } | null = null;
  let signoff: { id: string; status: string; comment: string | null; requested_at: string; decided_at: string | null } | null = null;
  if (purpose === "promotion" && candidate?.manager_id) {
    const [{ data: mgr }, { data: existingSignoff }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").eq("id", candidate.manager_id).maybeSingle(),
      supabase
        .from("promotion_signoffs")
        .select("id, status, comment, requested_at, decided_at")
        .eq("candidate_assessment_id", id)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    managerProfile = mgr;
    signoff = existingSignoff;
  }
  const requestSignoffWithId = requestManagerSignoff.bind(null, id);

  const scores = ((competencyScores || []) as unknown as {
    score: number;
    level: string;
    competency_id: string | null;
    competencies: { name: string; category: string } | null;
  }[])
    .filter((s) => s.competencies)
    .sort((a, b) => b.score - a.score);

  const competencyLines = scores.map((s) => ({
    name: s.competencies!.name,
    category: s.competencies!.category,
    score: s.score,
    level: s.level,
    target: s.competency_id ? targetByCompetency.get(s.competency_id) ?? null : null,
  }));

  const targeted = competencyLines.filter((l) => l.target !== null && l.target !== undefined);
  const meetingBar = targeted.filter((l) => l.score >= (l.target as number));
  const byCategory = categoryRollups(competencyLines);

  const peerScores = ((peerScoresRaw || []) as { id: string; overall_score: number }[]).map((p) => p.overall_score);
  const benchmark = computeBenchmark(ca.overall_score, peerScores);

  // Design-execution-plan Phase 5 / T5.1: typed once here (was previously
  // re-cast inline inside the JSX below) so the aggregate needs-review count
  // used by the new summary banner and the per-response badges further down
  // share one source of truth.
  const responseRows = (responses || []) as unknown as {
    id: string;
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
  const fallbackCount = responseRows.filter((r) => isUnreadByAi(r.ai_rationale)).length;

  // Who confirmed or changed each answer (migration 0023). Read on its own and
  // tolerant of the columns not existing yet: a failed read shows no history.
  const { data: reviewRows } = await supabase
    .from("candidate_responses")
    .select("id, ai_score, reviewed_at, reviewer_note")
    .eq("candidate_assessment_id", id);
  const reviewInfo = new Map(
    ((reviewRows || []) as unknown as { id: string; ai_score: number | null; reviewed_at: string | null; reviewer_note: string | null }[]).map((r) => [r.id, r])
  );
  // F5: answers are checked one by one, as steps.
  const checkedCount = responseRows.filter((r) => reviewInfo.get(r.id)?.reviewed_at).length;
  const nextToCheck = responseRows.find((r) => !reviewInfo.get(r.id)?.reviewed_at);

  // T5.1: the sorted bar list is the primary at-a-glance read of competency
  // performance (per the confirmed radar-demotion decision below); the radar
  // moves to a smaller, secondary spot further down the page instead of
  // sharing top billing with the score ring.
  const topCompetencies = competencyLines.slice(0, 5);

  let boxLabel: string | null = null;
  if (ca.overall_score !== null && competencyLines.length > 0) {
    const { potential } = potentialFromCompetencies(ca.overall_score, competencyLines);
    boxLabel = talentBoxFor(ca.overall_score, potential).label;
  }

  const executiveSummary =
    ca.overall_score !== null && competencyLines.length > 0
      ? buildExecutiveSummary({
          candidateName: candidate?.full_name || t.reviewer,
          overallScore: ca.overall_score,
          competencies: competencyLines,
          benchmark,
          boxLabel,
          purpose,
          words: t,
        })
      : null;

  const submitReviewWithId = submitReview.bind(null, id);

  // Extra time (migration 0018): read on its own, so a database that has not
  // had the migration yet just shows "none" instead of breaking this page.
  const { data: extraRow } = await supabase.from("candidate_assessments").select("extra_minutes").eq("id", id).maybeSingle();
  const extraMinutes = (extraRow as { extra_minutes?: number } | null)?.extra_minutes ?? 0;
  const { data: dueRow } = await supabase.from("candidate_assessments").select("due_at").eq("id", id).maybeSingle();
  const currentDue = (dueRow as { due_at?: string | null } | null)?.due_at ?? null;
  // Migration 0021: set when the answers arrived after the time limit. Read on
  // its own so the page works before the migration has been run.
  const { data: lateRow } = await supabase.from("candidate_assessments").select("submitted_late").eq("id", id).maybeSingle();
  const submittedLate = (lateRow as { submitted_late?: boolean } | null)?.submitted_late === true;
  const { data: limitRow } = await supabase.from("assessments").select("time_limit_minutes").eq("id", ca.assessment_id).maybeSingle();
  const limitMinutes = (limitRow as { time_limit_minutes?: number } | null)?.time_limit_minutes ?? 60;

  // The next person waiting for a decision (oldest submission first), so a
  // reviewer can work through the queue without going back to the list.
  const { data: waiting } = await supabase
    .from("candidate_assessments")
    .select("id, submitted_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name)")
    .in("status", ["submitted", "scored"])
    .neq("id", id)
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .limit(1);
  const nextWaiting = ((waiting || [])[0] ?? null) as unknown as { id: string; candidate: { full_name: string } | null } | null;

  return (
    <div className="px-6 lg:px-10 py-8 max-w-[1280px] mx-auto print-page">
      <Link
        href="/staff/reports/candidates"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-5 font-medium no-print"
      >
        <Icon name="arrowLeft" className="w-4 h-4" />
        {t.back}
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-5 mb-8">
        <div className="flex items-center gap-4">
          <Avatar name={candidate?.full_name || "?"} className="w-14 h-14 text-lg" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {candidate?.full_name}
            </h1>
            <p className="text-sm text-muted">{candidate?.email}</p>
            <p className="text-xs text-muted mt-1.5 flex flex-wrap items-center gap-2">
              {assessment?.title}
              <StatusBadge status={ca.status} labels={statusLabels} />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          <a
            href={`/report/${id}/pdf`}
            className={buttonClass({ size: "md" })}
          >
            <Icon name="download" className="w-4 h-4" />
            {t.downloadPdf}
          </a>
          <PrintButton label={t.print} />
        </div>
      </div>

      {decided && decided in t.decidedWords ? (
        <Callout
          tone="good"
          title={fillText(t.decidedTitle, { name: candidate?.full_name ?? "", word: t.decidedWords[decided as keyof typeof t.decidedWords] })}
          className="mb-6 no-print"
        >
          {t.decidedBody}{" "}
          {nextWaiting ? (
            <Link href={`/staff/reports/candidates/${nextWaiting.id}`} className="font-semibold underline">
              {fillText(t.nextCandidate, { name: nextWaiting.candidate?.full_name ?? t.nextFallback })}
            </Link>
          ) : (
            <span>{t.nobodyWaiting}</span>
          )}
          <form action={tellCandidateReviewed.bind(null, id)} className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-foreground">{t.tellQuestion}</span>
            <button className={buttonClass({ size: "sm", variant: "secondary" })}>{t.tellYes}</button>
            <span className="text-xs text-muted">{t.tellNote}</span>
          </form>
        </Callout>
      ) : null}
      {told ? <Callout tone="good" title={t.told} className="mb-6 no-print" /> : null}

      <a href="#decision" className="lg:hidden inline-flex items-center min-h-11 text-sm font-semibold underline mb-4 no-print">
        {t.goToDecision}
      </a>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem] gap-8 items-start">
      <div className="min-w-0">
      {submittedLate ? (
        <Callout tone="warning" title={t.lateTitle} className="mb-6 no-print">
          {t.lateBody}
        </Callout>
      ) : null}

      {/* Design-execution-plan Phase 5 / T5.1: the page now reads in the
          order a reviewer actually reasons in -- the evidence they'd want to
          check first, then the AI's contribution laid out so it's legible
          and easy to independently confirm or override, then the human
          decision itself. Previously the AI's scores/radar/benchmark came
          first and the candidate's actual answers were buried below all of
          it; a reviewer had to trust the number before ever seeing what it
          was based on. */}

      {fallbackCount > 0 && (
        <Callout tone="warning" title={t.fallbackTitle} className="mb-6 no-print">
          {pluralText(lang, fallbackCount, t.fallbackBody)}
        </Callout>
      )}

      {ca.overall_score !== null && <ScoringDisclosure className="mb-6 no-print" text={{ title: t.disclosureTitle, body: t.disclosureBody }} />}

      {/* T0.3's needs-review flag existed already but only as a small badge
          buried inside each response card below -- easy to miss if a
          reviewer skims. Surfaced here as its own summary so it's seen
          before anything else. */}
      {needsReviewCount > 0 && (
        <Card className="p-5 mb-6 flex items-start gap-3 bg-warning-soft border-warning/40 no-print">
          <Icon name="alertTriangle" className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-warning">{pluralText(lang, needsReviewCount, t.flaggedTitle)}</p>
            <p className="text-xs text-warning mt-0.5">{pluralText(lang, needsReviewCount, t.flaggedBody)}</p>
          </div>
        </Card>
      )}

      {/* ---------- Evidence ---------- */}
      {responseRows.length > 0 && (
        <Card className="p-6 mb-6">
          <p className="text-sm font-bold text-foreground mb-1">{t.evidenceTitle}</p>
          <p className="text-xs text-muted mb-4">{t.evidenceIntro}</p>
          <div className="mb-6 no-print" role="status">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-sm font-semibold text-foreground">
                {fillText(t.checked, { n: checkedCount, total: responseRows.length })}
              </p>
              {nextToCheck && canDecide && ["scored", "reviewed"].includes(ca.status) ? (
                <a href={`#answer-${nextToCheck.id}`} className="inline-flex items-center gap-1.5 min-h-11 text-sm font-semibold text-accent hover:underline">
                  {t.nextAnswer}
                  <Icon name="arrowRight" className="w-4 h-4" />
                </a>
              ) : checkedCount === responseRows.length ? (
                <span className="text-sm text-good font-semibold">{t.allChecked}</span>
              ) : null}
            </div>
            <ProgressBar value={responseRows.length ? (checkedCount / responseRows.length) * 100 : 0} barClass="bg-good" />
          </div>
          <div className="space-y-6">
            {responseRows.map((r, i) => {
              const b = bandFor(r.score);
              return (
                <div key={r.id} id={`answer-${r.id}`} className="border border-line rounded-xl p-5 scroll-mt-24">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
                    <div>
                      <p className="text-xs font-semibold text-muted mb-1">
                        {fillText(t.answerOf, { n: i + 1, total: responseRows.length })}
                      </p>
                      {r.questions?.competencies?.name && (
                        <p className="text-sm font-semibold text-accent-dark mb-1">
                          {r.questions.competencies.name}
                        </p>
                      )}
                      <p className="text-sm font-semibold text-foreground" {...contentLangAttr}>
                        {r.questions?.prompt}
                      </p>
                    </div>
                    <span className="flex items-center gap-2 shrink-0">
                      {(() => {
                        // Batch 28: also catches answers scored before this check existed.
                        const junk = checkNonsense(r.response_text);
                        return junk.nonsense ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-critical-soft text-critical ring-1 ring-inset ring-critical/30"
                            title={fillText(t.notRealTitle, { reason: t.nonsenseReasons[junk.code!] })}
                          >
                            <Icon name="alertTriangle" className="w-3 h-3" />
                            {t.notReal}
                          </span>
                        ) : null;
                      })()}
                      {r.needs_review && (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-warning-soft text-warning ring-1 ring-inset ring-warning/30"
                          title={t.needsReviewTitle}
                        >
                          <Icon name="alertTriangle" className="w-3 h-3" />
                          {t.needsReview}
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
                      {t.selected}{" "}
                      <span className="font-semibold text-foreground" {...contentLangAttr}>
                        {r.selected_option}. {r.questions?.options?.find((o) => o.key === r.selected_option)?.text ?? "—"}
                      </span>
                    </p>
                  )}
                  <p className="text-xs text-muted leading-relaxed flex items-start gap-2">
                    <Icon name="wand" className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent-dark" />
                    {readableRationale(r.ai_rationale)}
                  </p>
                  {(() => {
                    const info = reviewInfo.get(r.id);
                    return (
                      <div className="mt-4 pt-4 border-t border-line-soft no-print">
                        {info?.reviewed_at && (
                          <p className="text-sm text-muted mb-3">
                            <span className="font-semibold text-foreground">{t.confirmed}</span>{" "}
                            {fillText(t.confirmedOn, { date: new Date(info.reviewed_at).toLocaleDateString(locale) })}
                            {info.ai_score !== null && info.ai_score !== undefined ? ` · ${fillText(t.changedFrom, { from: info.ai_score, to: r.score })}` : ""}
                            {info.reviewer_note ? ` — “${info.reviewer_note}”` : ""}
                          </p>
                        )}
                        {canDecide && ["scored", "reviewed"].includes(ca.status) && (
                          <div className="flex flex-wrap items-start gap-3">
                            <form action={reviewAnswer.bind(null, id, r.id)}>
                              <input type="hidden" name="mode" value="agree" />
                              <SubmitButton size="sm" variant="secondary" pendingLabel={t.saving}>
                                {t.agree}
                              </SubmitButton>
                            </form>
                            <details className="min-w-0">
                              <summary className="cursor-pointer min-h-11 inline-flex items-center text-sm font-semibold text-accent">{t.changeScore}</summary>
                              <form action={reviewAnswer.bind(null, id, r.id)} className="mt-2 flex flex-wrap items-end gap-3">
                                <input type="hidden" name="mode" value="change" />
                                <label className="text-sm font-semibold text-foreground">
                                  {t.newScore}
                                  <input
                                    name="score"
                                    type="number"
                                    min={0}
                                    max={100}
                                    required
                                    defaultValue={r.score}
                                    className="mt-1 block w-28 min-h-12 rounded-md border border-line-control bg-surface px-3 text-base"
                                  />
                                </label>
                                <label className="text-sm font-semibold text-foreground flex-1 min-w-[12rem]">
                                  {t.why}
                                  <input
                                    name="note"
                                    required
                                    minLength={5}
                                    maxLength={300}
                                    className="mt-1 block w-full min-h-12 rounded-md border border-line-control bg-surface px-3 text-base font-normal"
                                  />
                                </label>
                                <SubmitButton size="md" pendingLabel={t.saving}>
                                  {t.saveScore}
                                </SubmitButton>
                              </form>
                            </details>
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
            <Icon name="video" className="w-4 h-4 text-accent-dark" />
            {t.recordingsTitle}
          </p>
          <p className="text-xs text-muted mb-4">{t.recordingsIntro}</p>
          <div className="space-y-3">
            {recordingsWithUrls.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between gap-4 border border-line rounded-xl px-4 py-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-foreground">
                    {recordingsWithUrls.length > 1 ? `${fillText(t.part, { n: i + 1, total: recordingsWithUrls.length })} · ` : ""}
                    {r.consent_given_at ? new Date(r.consent_given_at).toLocaleString(locale) : t.unknownTime} ·{" "}
                    {formatRecordingLength(r.duration_seconds, t)}
                  </p>
                  <p className="text-xs text-muted">
                    {r.url ? t.stored : t.localOnly}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.url && (
                    <>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-dark hover:underline"
                      >
                        <Icon name="play" className="w-3.5 h-3.5" />
                        {t.watch}
                      </a>
                      <a
                        href={r.url}
                        download
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-dark hover:underline"
                      >
                        <Icon name="download" className="w-3.5 h-3.5" />
                        {t.download}
                      </a>
                    </>
                  )}
                  <form action={deleteProctoringRecording.bind(null, id, r.id, r.storage_path)}>
                    <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-critical hover:underline">
                      <Icon name="trash" className="w-3.5 h-3.5" />
                      {t.delete}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ---------- The AI's contribution ---------- */}
      {ca.overall_score !== null ? (
        <>
          {executiveSummary && <ExecutiveSummaryCard summary={executiveSummary} purpose={purpose} text={t} />}

          {/* T5.1 (radar demotion, confirmed): the sorted bar list is the
              primary at-a-glance read next to the score, not the radar --
              see the Competency radar card further down for why. */}
          <div className="grid md:grid-cols-[auto_1fr] gap-5 mb-6">
            <Card className="p-7 flex flex-col items-center justify-center gap-2 min-w-56">
              <p className="text-sm font-semibold text-muted">{t.overallFit}</p>
              <ScoreRing score={Math.round(ca.overall_score)} size={128} label={bandLabelFor(ca.overall_score, dict.candidate.bands)} />
              <p className="text-xs text-muted text-center max-w-44 mt-1">{t.ringNote}</p>
            </Card>
            <Card className="p-7">
              <p className="text-sm font-semibold text-muted mb-4">{t.topCompetencies}</p>
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
                <p className="text-sm text-muted py-8 text-center">{t.noScored}</p>
              )}
            </Card>
          </div>

          <BenchmarkCard
            benchmark={benchmark}
            assessmentTitle={assessment?.title}
            boxLabel={boxLabel}
            text={t}
          />

          {targeted.length > 0 && (
            <Card className="p-5 mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">
                {fillNodes(t.roleBar, {
                  count: (
                    <span className={meetingBar.length === targeted.length ? "text-good" : meetingBar.length === 0 ? "text-critical" : "text-accent-dark"}>
                      {fillText(t.roleBarCount, { n: meetingBar.length, total: targeted.length })}
                    </span>
                  ),
                })}
              </p>
              <p className="text-xs text-muted">{t.targetsNote}</p>
            </Card>
          )}

          {/* Competency bars by category */}
          {byCategory.map(({ cat, rows, avg }) => {
            const style = categoryStyle(cat);
            return (
              <Card key={cat} className="p-6 mb-5">
                <p className="flex items-center gap-2 text-sm font-bold text-foreground mb-5">
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                  {fillText(t.categoryTitle, { category: (t.categories as Record<string, string>)[cat] ?? cat })}
                  {avg !== null && <span className="ml-auto text-xs font-bold text-muted tabular-nums">{fillText(t.avg, { n: avg })}</span>}
                </p>
                <div className="space-y-4">
                  {rows.map((s, i) => {
                    const b = bandFor(s.score);
                    const target = s.target ?? null;
                    const barState =
                      target === null ? null : s.score >= target + 10 ? "exceeds" : s.score >= target ? "meets" : "below";
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-medium text-foreground">{s.name}</span>
                          <span className="flex items-center gap-2.5">
                            {barState && (
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${
                                  barState === "below"
                                    ? "bg-critical-soft text-critical ring-critical/30"
                                    : barState === "exceeds"
                                      ? "bg-good-soft text-good ring-good/30"
                                      : "bg-line-soft text-foreground ring-line"
                                }`}
                                title={fillText(t.targetForRole, { n: target ?? "" })}
                              >
                                {barState === "exceeds" ? t.exceedsBar : barState === "meets" ? t.meetsBar : t.belowBar} · {target}
                              </span>
                            )}
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${b.badge}`}>
                              {bandLabelFor(s.score, dict.candidate.bands)}
                            </span>
                            <span className="font-bold tabular-nums w-8 text-right">{Math.round(s.score)}</span>
                          </span>
                        </div>
                        <div className="relative h-2 rounded-full bg-line/70 overflow-hidden">
                          <div className="h-full rounded-full anim-grow" style={{ width: `${s.score}%`, background: style.hex }} />
                          {target !== null && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-foreground/70"
                              style={{ left: `${target}%` }}
                              title={fillText(t.target, { n: target })}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {/* Design-execution-plan Phase 3 / T3.5 (confirmed at Phase 5):
              the radar used to share top billing with the score ring; the
              sorted bar lists above are more accurate to scan (a radar's
              equal-angle axes visually distort relative differences), so
              this is now a collapsed, opt-in secondary view -- <details> is
              natively keyboard/screen-reader operable with no extra ARIA. */}
          {scores.length >= 3 && (
            <Card className="p-6 mb-5">
              <details>
                <summary className="text-sm font-bold text-foreground cursor-pointer select-none">
                  {t.radar}
                </summary>
                <div className="mt-4 max-w-md mx-auto">
                  <RadarChart items={scores.slice(0, 8).map((s) => ({ label: s.competencies!.name, value: Math.round(s.score) }))} />
                </div>
              </details>
            </Card>
          )}
        </>
      ) : (
        <Card className="p-6 mb-6 flex items-center gap-3 text-sm text-warning bg-warning-soft border-warning/40">
          <Icon name="clock" className="w-5 h-5 shrink-0" />
          {t.notSubmitted}
        </Card>
      )}

      </div>

      {/* ---------- The human decision (stays in view beside the evidence) ---------- */}
      <aside id="decision" aria-label={t.decisionAria} className="space-y-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto scroll-mt-20">
      {["invited", "in_progress"].includes(ca.status) && (
        <ExtraTimeCard action={setExtraTime.bind(null, id)} current={extraMinutes} limitMinutes={limitMinutes} text={t} />
      )}

      {["invited", "in_progress"].includes(ca.status) && (
        <Card className="p-5">
          <p className="text-sm font-bold text-foreground mb-1">{t.deadlineTitle}</p>
          <p className="text-xs text-muted mb-3">
            {currentDue ? fillText(t.deadlineEnds, { date: new Date(currentDue).toLocaleDateString(locale, { timeZone: "Asia/Baku" }) }) : t.deadlineNone}{" "}
            {t.deadlineHint}
          </p>
          <form action={setDeadline.bind(null, id)} className="flex flex-wrap items-end gap-2">
            <input
              type="date"
              name="due_date"
              min={orgToday()}
              defaultValue={currentDue ? new Date(currentDue).toLocaleDateString("en-CA", { timeZone: "Asia/Baku" }) : ""}
              aria-label={t.deadlineTitle}
              className="bg-surface border border-line-control rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button className={buttonClass({ size: "sm" })}>{t.deadlineSave}</button>
          </form>
        </Card>
      )}

      {/* Manager sign-off (promotion only) */}
      {purpose === "promotion" && (
        <Card className="p-6 mb-6 no-print">
          <p className="text-sm font-bold text-foreground mb-1">{t.signoffTitle}</p>
          {!candidate?.manager_id ? (
            <p className="text-xs text-muted">{t.signoffNoManager}</p>
          ) : !managerProfile ? (
            <p className="text-xs text-muted">{t.signoffNotFound}</p>
          ) : !signoff ? (
            <>
              <p className="text-xs text-muted mb-4">
                {fillNodes(t.signoffAsk, { name: <span className="font-semibold text-foreground">{managerProfile.full_name}</span> })}
              </p>
              <form action={requestSignoffWithId}>
                <button className={buttonClass({ size: "md" })}>
                  <Icon name="send" className="w-4 h-4" />
                  {fillText(t.signoffRequest, { name: managerProfile.full_name })}
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <StatusBadge
                status={signoff.status === "pending" ? "signoff_pending" : signoff.status === "approved" ? "signoff_approved" : "signoff_declined"}
                labels={statusLabels}
              />
              <div className="text-sm text-muted">
                <p>
                  {fillNodes(signoff.status === "pending" ? t.signoffPending : signoff.status === "approved" ? t.signoffApproved : t.signoffDeclined, {
                    name: <span className="font-semibold text-foreground">{managerProfile.full_name}</span>,
                  })}
                </p>
                {signoff.comment && <p className="mt-1 italic">&ldquo;{signoff.comment}&rdquo;</p>}
                <p className="text-muted text-xs mt-1">
                  {fillText(t.signoffRequested, { date: new Date(signoff.requested_at).toLocaleString(locale) })}
                  {signoff.decided_at ? ` · ${fillText(t.signoffDecided, { date: new Date(signoff.decided_at).toLocaleString(locale) })}` : ""}
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Decision */}
      <Card className="p-6">
        <p className="text-sm font-bold text-foreground mb-1">{purposeMeta.reviewerTitle}</p>
        <p className="text-xs text-muted mb-5">{purposeMeta.blurb}</p>
        {!canDecide ? (
          <p className="mb-4 rounded-card bg-surface p-4 text-sm text-muted no-print" role="status">
            {isOwnAssessment ? t.ownAssessment : t.notSubmittedYet}
          </p>
        ) : null}
        {/* STF-B-12: this reviewer's page loaded before someone else decided,
            so their own decision would otherwise be layered on silently. */}
        {conflictBy && conflictDecision ? (
          <div role="alertdialog" aria-labelledby="decision-conflict-h" className="mb-4 rounded-card border border-warning/40 bg-warning-soft p-4 no-print">
            <p id="decision-conflict-h" className="text-sm font-semibold text-warning">
              {fillNodes(t.conflictTitle, {
                name: <span className="font-bold">{conflictBy}</span>,
                decision: <span className="font-bold">{decisionOptions.find((o) => o.v === conflictAs)?.label ?? conflictAs}</span>,
              })}
            </p>
            <p className="mt-1 text-sm text-warning">
              {fillNodes(t.conflictBody, {
                decision: <span className="font-semibold">{decisionOptions.find((o) => o.v === conflictDecision)?.label ?? conflictDecision}</span>,
              })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <form action={submitReviewWithId}>
                <input type="hidden" name="decision" value={conflictDecision} />
                <input type="hidden" name="comment" value={conflictComment || ""} />
                <input type="hidden" name="loaded_at" value={loadedAtMs} />
                <input type="hidden" name="force" value="1" />
                <button className={buttonClass({ size: "sm" })}>{t.addAnyway}</button>
              </form>
              <Link href={`/staff/reports/candidates/${id}`} className={buttonClass({ size: "sm", variant: "secondary" })}>
                {t.reconsider}
              </Link>
            </div>
          </div>
        ) : null}
        <form action={submitReviewWithId} hidden={!canDecide} className="space-y-3.5 no-print">
          <input type="hidden" name="loaded_at" value={loadedAtMs} />
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
            placeholder={t.notesPlaceholder}
            aria-label={t.notesPlaceholder}
            className="w-full bg-surface border border-line-control rounded-xl px-4 py-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button className={buttonClass({ size: "md" })}>
            <Icon name="send" className="w-4 h-4" />
            {t.submitDecision}
          </button>
        </form>

        {reviews && reviews.length > 0 && (() => {
          const reviewRows = reviews as unknown as {
            decision: string;
            comment: string;
            created_at: string;
            reviewer_id: string | null;
            reviewer: { full_name: string } | null;
          }[];
          // Disagreement means different reviewers, so only each reviewer's latest
          // decision counts (rows are newest first). One person changing their own
          // mind is not a disagreement (STF-B-09).
          const latestPerReviewer = new Map<string, string>();
          for (const r of reviewRows) if (r.reviewer_id && !latestPerReviewer.has(r.reviewer_id)) latestPerReviewer.set(r.reviewer_id, r.decision);
          const decisionName = decisionWord;
          const distinctDecisions = Array.from(new Set(latestPerReviewer.values())).map(decisionName);
          const diverges = latestPerReviewer.size >= 2 && distinctDecisions.length > 1;
          return (
            <div className="mt-6 space-y-3 border-t border-line pt-5">
              <p className="text-sm font-semibold text-muted">
                {reviewRows.length >= 2 ? t.calibration : t.history}
              </p>
              {diverges && (
                <div className="flex items-start gap-2.5 bg-critical-soft text-critical rounded-xl px-4 py-3 text-sm">
                  <Icon name="alertTriangle" className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{fillText(t.disagree, { decisions: distinctDecisions.join(t.versus) })}</p>
                </div>
              )}
              {reviewRows.length >= 2 ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {reviewRows.map((r, i) => (
                    <div key={i} className="border border-line rounded-xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="font-semibold text-foreground text-sm">{r.reviewer?.full_name || t.reviewer}</p>
                        <StatusBadge status={r.decision} labels={statusLabels} />
                      </div>
                      {r.comment && <p className="text-xs text-muted">“{r.comment}”</p>}
                      <p className="text-muted text-xs mt-2">{new Date(r.created_at).toLocaleString(locale)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                reviewRows.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <StatusBadge status={r.decision} labels={statusLabels} />
                    <p className="text-muted">
                      <span className="font-semibold text-foreground">{r.reviewer?.full_name}</span>
                      {r.comment ? ` — “${r.comment}”` : ""}
                      <span className="text-muted text-xs"> · {new Date(r.created_at).toLocaleString(locale)}</span>
                    </p>
                  </div>
                ))
              )}
            </div>
          );
        })()}
      </Card>

      {viewerIsAdmin && ca.status === "reviewed" && (
        <Card className="p-6 mt-5 no-print">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-foreground mb-1">{t.feedbackTitle}</p>
              <p className="text-xs text-muted max-w-xl">
                {ca.feedback_released_at
                  ? fillText(t.feedbackReleased, { date: new Date(ca.feedback_released_at).toLocaleString(locale) })
                  : t.feedbackNotReleased}
              </p>
            </div>
            {!ca.feedback_released_at && (
              <form action={releaseFeedback.bind(null, id)}>
                <button className={buttonClass({ size: "md" })}>
                  <Icon name="send" className="w-4 h-4" />
                  {t.releaseFeedback}
                </button>
              </form>
            )}
          </div>
        </Card>
      )}
      {nextWaiting && !decided && (
        <Link href={`/staff/reports/candidates/${nextWaiting.id}`} className="no-print inline-flex items-center gap-1.5 text-sm font-semibold underline min-h-11">
          {fillText(t.skipNext, { name: nextWaiting.candidate?.full_name ?? t.skipFallback })}
          <Icon name="arrowRight" className="w-4 h-4" />
        </Link>
      )}
      </aside>
      </div>
    </div>
  );
}

function formatRecordingLength(seconds: number | null, t: { seconds: string; minutes: string }): string {
  if (!seconds) return "—";
  if (seconds < 90) return fillText(t.seconds, { n: Math.round(seconds) });
  return fillText(t.minutes, { n: Math.round(seconds / 60) });
}
