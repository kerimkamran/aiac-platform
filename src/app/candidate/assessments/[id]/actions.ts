"use server";

import { createClient } from "@/lib/supabase/server";
import { scoreMcqResponse, scoreTextResponse } from "@/lib/scoring";
import { redirect } from "next/navigation";

type QuestionOption = { key: string; text: string; correct?: boolean };

export async function startAssessment(candidateAssessmentId: string) {
  const supabase = await createClient();
  await supabase
    .from("candidate_assessments")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", candidateAssessmentId)
    .eq("status", "invited");
}

export async function submitAssessment(candidateAssessmentId: string, formData: FormData) {
  const supabase = await createClient();

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select("id, assessment_id, candidate_id")
    .eq("id", candidateAssessmentId)
    .single();

  if (!ca) redirect("/candidate");

  const { data: sections } = await supabase
    .from("assessment_sections")
    .select("id, competency_id, questions(id, question_type, options, weight)")
    .eq("assessment_id", ca.assessment_id);

  type QRow = { id: string; question_type: string; options: QuestionOption[] | null; weight: number };
  type SRow = { id: string; competency_id: string; questions: QRow[] };

  const allSections = (sections || []) as unknown as SRow[];

  const competencyTotals: Record<string, { weighted: number; totalWeight: number }> = {};
  let overallWeighted = 0;
  let overallWeight = 0;

  for (const section of allSections) {
    for (const q of section.questions || []) {
      let result;
      if (q.question_type === "mcq") {
        const selected = String(formData.get(`q_${q.id}`) || "");
        result = scoreMcqResponse(q.options || [], selected || null);
        await supabase.from("candidate_responses").insert({
          candidate_assessment_id: candidateAssessmentId,
          question_id: q.id,
          selected_option: selected || null,
          score: result.score,
          ai_rationale: result.rationale,
        });
      } else {
        const text = String(formData.get(`q_${q.id}`) || "");
        result = scoreTextResponse(text);
        await supabase.from("candidate_responses").insert({
          candidate_assessment_id: candidateAssessmentId,
          question_id: q.id,
          response_text: text,
          score: result.score,
          ai_rationale: result.rationale,
        });
      }

      const w = Number(q.weight) || 1;
      competencyTotals[section.competency_id] = competencyTotals[section.competency_id] || {
        weighted: 0,
        totalWeight: 0,
      };
      competencyTotals[section.competency_id].weighted += result.score * w;
      competencyTotals[section.competency_id].totalWeight += w;
      overallWeighted += result.score * w;
      overallWeight += w;
    }
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

  redirect("/candidate/assessments?submitted=1");
}
