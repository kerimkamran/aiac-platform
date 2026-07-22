"use server";

// Shared "Discuss with AI" report-chat actions, used from both
// staff/candidates/[id] and decision/candidates/[id] -- mirrors the existing
// submitReview() pattern of one action file shared across both role areas,
// with requireRole(...STAFF_ROLES, "decision_maker") as the entry check and
// RLS's is_assigned_decision_maker() as the real per-row backstop.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole, STAFF_ROLES } from "@/lib/authz";
import { runReportChat, type ReportContext, type ReportChatMessage } from "@/lib/report-chat";
import { normalizePurpose } from "@/lib/purpose";

async function buildReportContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  candidateAssessmentId: string
): Promise<ReportContext> {
  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select(
      "id, assessment_id, overall_score, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name), assessments(title, purpose)"
    )
    .eq("id", candidateAssessmentId)
    .single();
  if (!ca) throw new Error("Report not found.");

  const candidate = ca.candidate as unknown as { full_name: string } | null;
  const assessment = ca.assessments as unknown as { title: string; purpose: string | null } | null;
  const purpose = normalizePurpose(assessment?.purpose);

  const [{ data: peerScoresRaw }, { data: competencyScores }, { data: responses }, { data: reviews }] = await Promise.all([
    supabase.from("candidate_assessments").select("id, overall_score").eq("assessment_id", ca.assessment_id).not("overall_score", "is", null),
    supabase.from("candidate_competency_scores").select("score, level, competencies(name, category)").eq("candidate_assessment_id", candidateAssessmentId),
    supabase
      .from("candidate_responses")
      .select("response_text, selected_option, score, ai_rationale, questions(prompt, question_type, options, competencies(name))")
      .eq("candidate_assessment_id", candidateAssessmentId),
    supabase
      .from("candidate_reviews")
      .select("decision, comment, reviewer:profiles!candidate_reviews_reviewer_id_fkey(full_name)")
      .eq("candidate_assessment_id", candidateAssessmentId)
      .order("created_at", { ascending: false }),
  ]);

  const competencies = ((competencyScores || []) as unknown as {
    score: number;
    level: string;
    competencies: { name: string; category: string } | null;
  }[])
    .filter((s) => s.competencies)
    .map((s) => ({ name: s.competencies!.name, category: s.competencies!.category, score: s.score, level: s.level }));

  const respRows = (responses || []) as unknown as {
    response_text: string | null;
    selected_option: string | null;
    score: number;
    ai_rationale: string;
    questions: { prompt: string; question_type: string; options: { key: string; text: string }[] | null; competencies: { name: string } | null } | null;
  }[];

  const reportResponses = respRows.map((r) => {
    const answer = r.response_text
      ? r.response_text
      : r.selected_option
        ? `${r.selected_option}. ${r.questions?.options?.find((o) => o.key === r.selected_option)?.text ?? ""}`
        : "(no answer on file)";
    return {
      competencyName: r.questions?.competencies?.name ?? null,
      prompt: r.questions?.prompt ?? null,
      answer,
      score: r.score,
      rationale: r.ai_rationale,
    };
  });

  const peerScores = ((peerScoresRaw || []) as { id: string; overall_score: number }[]).map((p) => p.overall_score);
  const clean = peerScores.filter((s) => typeof s === "number" && !Number.isNaN(s));
  const peerCount = clean.length;
  let benchmark: ReportContext["benchmark"] = null;
  if (ca.overall_score !== null && peerCount > 0) {
    const peerAvg = Math.round((clean.reduce((a, b) => a + b, 0) / peerCount) * 10) / 10;
    const percentile = peerCount > 1 ? Math.round((clean.filter((s) => s < ca.overall_score!).length / (peerCount - 1)) * 100) : null;
    benchmark = { percentile, peerAvg, peerCount };
  }

  const priorDecisions = ((reviews || []) as unknown as { decision: string; comment: string | null; reviewer: { full_name: string } | null }[]).map(
    (r) => ({ decision: r.decision, comment: r.comment, reviewer: r.reviewer?.full_name ?? null })
  );

  return {
    candidateName: candidate?.full_name || "This candidate",
    assessmentTitle: assessment?.title || "Assessment",
    purpose,
    overallScore: ca.overall_score,
    competencies,
    responses: reportResponses,
    benchmark,
    boxLabel: null,
    priorDecisions,
  };
}

export async function getOrCreateReportThread(candidateAssessmentId: string) {
  const profile = await requireRole(...STAFF_ROLES, "decision_maker");
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("report_ai_threads")
    .select("id")
    .eq("candidate_assessment_id", candidateAssessmentId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data: messages } = await supabase
      .from("report_ai_messages")
      .select("role, content, created_at")
      .eq("thread_id", existing.id)
      .order("created_at", { ascending: true });
    return { threadId: existing.id as string, messages: (messages || []) as { role: "user" | "assistant"; content: string; created_at: string }[] };
  }

  const { data: created, error } = await supabase
    .from("report_ai_threads")
    .insert({ candidate_assessment_id: candidateAssessmentId, created_by: profile.id })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message || "Could not start a chat thread.");

  return { threadId: created.id as string, messages: [] as { role: "user" | "assistant"; content: string; created_at: string }[] };
}

export async function sendReportChatMessage(
  candidateAssessmentId: string,
  threadId: string,
  history: ReportChatMessage[],
  userMessage: string
) {
  await requireRole(...STAFF_ROLES, "decision_maker");
  const supabase = await createClient();
  const trimmed = userMessage.trim();
  if (!trimmed) throw new Error("Message can't be empty.");
  if (trimmed.length > 4000) throw new Error("Message is too long (max 4000 characters).");

  // Persist the user message first so the thread survives even if the Kimi
  // call below fails.
  const { error: insertUserErr } = await supabase
    .from("report_ai_messages")
    .insert({ thread_id: threadId, role: "user", content: trimmed });
  if (insertUserErr) throw new Error(insertUserErr.message);

  const ctx = await buildReportContext(supabase, candidateAssessmentId);
  const reply = await runReportChat(supabase, ctx, [...history, { role: "user", content: trimmed }]);

  await supabase.from("report_ai_messages").insert({ thread_id: threadId, role: "assistant", content: reply });
  await supabase.from("report_ai_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);

  revalidatePath(`/staff/reports/candidates/${candidateAssessmentId}`);
  revalidatePath(`/decision/candidates/${candidateAssessmentId}`);

  return reply;
}
