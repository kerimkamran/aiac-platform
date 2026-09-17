"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreTextResponse, type CompetencyContext, type ScoringEngine } from "@/lib/scoring";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

type RunnerRow = {
  section_id: string;
  section_competency_id: string;
  question_id: string;
  question_type: string;
  prompt: string;
  weight: number;
  question_competency_id: string | null;
};

export async function startAssessment(candidateAssessmentId: string) {
  const supabase = await createClient();
  await supabase
    .from("candidate_assessments")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", candidateAssessmentId)
    .eq("status", "invited");
  revalidatePath(`/candidate/assessments/${candidateAssessmentId}`);
}

export async function submitAssessment(candidateAssessmentId: string, formData: FormData) {
  const supabase = await createClient();

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select("id, assessment_id, candidate_id, assessments(engine)")
    .eq("id", candidateAssessmentId)
    .single();

  if (!ca) redirect("/candidate");

  const engineRaw = (ca.assessments as unknown as { engine: string | null } | null)?.engine || null;
  const engine: ScoringEngine | null =
    engineRaw === "claude" || engineRaw === "fugu" || engineRaw === "kimi" ? engineRaw : null;

  // The AI-provider API key never touches this action's own RLS-scoped
  // client: generation_engines is staff-only, and get_engine_api_key_for_scoring
  // is revoked from authenticated/anon at the grant level (see
  // supabase/migrations/0012_secure_mcq_scoring.sql) -- only the
  // service-role admin client can call it. No engine configured, or no
  // service role key in this environment, just means text scoring falls
  // back to the heuristic below; it never blocks the submission.
  let apiKey: string | null = null;
  if (engine) {
    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin.rpc("get_engine_api_key_for_scoring", { p_engine_key: engine });
      apiKey = (data as string | null) || null;
    }
  }

  // Enumerates this assessment's questions through the same SECURITY
  // DEFINER RPC the runner page uses -- the base `questions` table is
  // staff-only now, and this action never needs `options` at all (MCQ
  // grading happens inside submit_mcq_answer, entirely in Postgres).
  const { data: runnerRows } = await supabase.rpc("get_runner_questions", {
    p_candidate_assessment_id: candidateAssessmentId,
  });

  const rows = (runnerRows || []) as unknown as RunnerRow[];

  // Preload competency name/description/behavioural indicators for every
  // competency referenced -- text scoring grades against these, not a
  // generic rubric. (competencies/competency_indicators stay readable by
  // any authenticated user, unlike questions.)
  const competencyIds = Array.from(
    new Set(rows.map((r) => r.question_competency_id || r.section_competency_id).filter(Boolean))
  ) as string[];

  const competencyMap = new Map<string, CompetencyContext>();
  if (competencyIds.length > 0) {
    const [{ data: comps }, { data: indicators }] = await Promise.all([
      supabase.from("competencies").select("id, name, description").in("id", competencyIds),
      supabase.from("competency_indicators").select("competency_id, level, indicator_text").in("competency_id", competencyIds),
    ]);
    for (const c of comps || []) {
      competencyMap.set(c.id, { name: c.name, description: c.description, indicators: [] });
    }
    for (const i of indicators || []) {
      competencyMap.get(i.competency_id)?.indicators.push({ level: i.level, indicator_text: i.indicator_text });
    }
  }

  const competencyTotals: Record<string, { weighted: number; totalWeight: number }> = {};
  let overallWeighted = 0;
  let overallWeight = 0;

  for (const q of rows) {
    let result: { score: number } | null = null;

    if (q.question_type === "mcq") {
      const selected = String(formData.get(`q_${q.question_id}`) || "") || null;
      // Graded entirely inside Postgres -- the correct option never
      // travels through this server action or the browser. A rejection
      // (e.g. a retried submit hitting the one-response-per-question
      // guard) just skips re-scoring this question rather than throwing
      // the whole submission away; the first, successful call already
      // recorded and counted its score.
      const { data, error } = await supabase.rpc("submit_mcq_answer", {
        p_candidate_assessment_id: candidateAssessmentId,
        p_question_id: q.question_id,
        p_selected_key: selected,
      });
      if (!error && data && data.length > 0) {
        result = { score: Number(data[0].score) };
      }
    } else {
      const text = String(formData.get(`q_${q.question_id}`) || "");
      const competencyId = q.question_competency_id || q.section_competency_id;
      const competency = (competencyId && competencyMap.get(competencyId)) || {
        name: "General",
        description: null,
        indicators: [],
      };
      const scored = await scoreTextResponse({ questionPrompt: q.prompt, responseText: text, competency, engine, apiKey });
      const { error } = await supabase.from("candidate_responses").insert({
        candidate_assessment_id: candidateAssessmentId,
        question_id: q.question_id,
        response_text: text,
        score: scored.score,
        ai_rationale: scored.rationale,
      });
      // 23505 = unique_violation -- a retried submit for a question already
      // recorded. Same "skip, don't throw" handling as the MCQ branch above.
      if (!error) result = { score: scored.score };
      else if (error.code !== "23505") throw error;
    }

    if (!result) continue;

    const w = Number(q.weight) || 1;
    competencyTotals[q.section_competency_id] = competencyTotals[q.section_competency_id] || {
      weighted: 0,
      totalWeight: 0,
    };
    competencyTotals[q.section_competency_id].weighted += result.score * w;
    competencyTotals[q.section_competency_id].totalWeight += w;
    overallWeighted += result.score * w;
    overallWeight += w;
  }

  for (const [competencyId, totals] of Object.entries(competencyTotals)) {
    const score = totals.totalWeight > 0 ? totals.weighted / totals.totalWeight : 0;
    await supabase.from("candidate_competency_scores").insert({
      candidate_assessment_id: candidateAssessmentId,
      competency_id: competencyId,
      score: Math.round(score * 10) / 10,
      level: score >= 85 ? "Exceeds" : score >= 70 ? "Fully Meets" : score >= 50 ? "Partially Meets" : "Does Not Meet",
    });
  }

  const overallScore = overallWeight > 0 ? Math.round((overallWeighted / overallWeight) * 10) / 10 : 0;

  const tabSwitchCount = Number(formData.get("tab_switch_count") || 0) || 0;

  await supabase
    .from("candidate_assessments")
    .update({
      status: "scored",
      submitted_at: new Date().toISOString(),
      overall_score: overallScore,
      tab_switch_count: tabSwitchCount,
    })
    .eq("id", candidateAssessmentId);

  redirect(`/candidate/assessments/${candidateAssessmentId}/submitted`);
}
