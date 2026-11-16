"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreAttempt } from "@/lib/score-attempt";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const SUBMIT_FAILED = "We couldn't submit. Your answers are still here. Try again.";

export async function startAssessment(candidateAssessmentId: string) {
  const supabase = await createClient();
  // Server clock, ownership and the due date are checked inside start_attempt.
  await supabase.rpc("start_attempt", { p_candidate_assessment_id: candidateAssessmentId });
  revalidatePath(`/candidate/assessments/${candidateAssessmentId}`);
}

// Saves the answers so far on the server (E-05), so a closed laptop or a dead
// battery loses nothing and an expired attempt can be closed with what was
// written. Never throws: the exam keeps its on-device copy either way.
export async function saveDraft(candidateAssessmentId: string, answers: Record<string, string>): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_attempt_draft", {
      p_candidate_assessment_id: candidateAssessmentId,
      p_answers: answers,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function submitAssessment(
  candidateAssessmentId: string,
  formData: FormData
): Promise<{ error: string } | void> {
  const supabase = await createClient();

  const { data: ca } = await supabase.from("candidate_assessments").select("id").eq("id", candidateAssessmentId).maybeSingle();
  if (!ca) redirect("/candidate");

  // Scores and the final status are written by the server, never by the
  // candidate's own session. Without the service key the answers stay on the
  // device and the candidate can try again.
  const db = createAdminClient();
  if (!db) return { error: "We couldn't submit right now. Your answers are still here. Try again in a moment." };

  // Locks the attempt and moves it to "submitted" exactly once. A second tab or
  // a retry after a failed scoring is safe: scored work is never touched again.
  const { data: before, error: gateError } = await supabase.rpc("begin_submit", {
    p_candidate_assessment_id: candidateAssessmentId,
  });
  if (gateError) return { error: SUBMIT_FAILED };
  if (before === "scored" || before === "reviewed") {
    redirect(`/candidate/assessments/${candidateAssessmentId}/submitted`);
  }

  // The answers in the form win; the saved draft fills any the form lacks.
  const { data: draftRow } = await db
    .from("candidate_assessments")
    .select("draft_answers")
    .eq("id", candidateAssessmentId)
    .maybeSingle();
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries((draftRow?.draft_answers as Record<string, string> | null) ?? {})) {
    answers[k] = String(v ?? "");
  }
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("q_")) {
      const text = String(value ?? "");
      if (text !== "" || !(key.slice(2) in answers)) answers[key.slice(2)] = text;
    }
  }

  const tabSwitchCount = Number(formData.get("tab_switch_count") || 0) || 0;
  const result = await scoreAttempt(db, { candidateAssessmentId, answers, tabSwitchCount });
  if (!result.ok) return { error: SUBMIT_FAILED };

  // The runner's submit reason reaches the confirmation page so it never
  // celebrates a submission the countdown forced through at zero.
  const reason = String(formData.get("submit_reason") || "manual");
  const suffix = reason === "expiry" ? "?reason=expiry" : "";
  redirect(`/candidate/assessments/${candidateAssessmentId}/submitted${suffix}`);
}
