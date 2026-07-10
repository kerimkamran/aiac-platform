"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole, STAFF_ROLES } from "@/lib/authz";

export async function submitReview(candidateAssessmentId: string, formData: FormData) {
  // Shared with decision/candidates/[id]/actions.ts, so decision makers are
  // allowed here too; RLS's is_assigned_decision_maker() scopes which
  // specific candidate_assessment a given decision maker may actually write.
  await requireRole(...STAFF_ROLES, "decision_maker");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const decision = String(formData.get("decision") || "");
  const comment = String(formData.get("comment") || "");

  await supabase.from("candidate_reviews").insert({
    candidate_assessment_id: candidateAssessmentId,
    reviewer_id: user!.id,
    decision,
    comment,
  });

  await supabase
    .from("candidate_assessments")
    .update({ status: "reviewed" })
    .eq("id", candidateAssessmentId);

  revalidatePath(`/staff/candidates/${candidateAssessmentId}`);
}

export async function deleteProctoringRecording(candidateAssessmentId: string, recordingId: string, storagePath: string | null) {
  await requireRole(...STAFF_ROLES);
  const supabase = await createClient();

  if (storagePath) {
    await supabase.storage.from("proctoring").remove([storagePath]);
  }
  await supabase.from("proctoring_recordings").update({ deleted_at: new Date().toISOString() }).eq("id", recordingId);

  revalidatePath(`/staff/candidates/${candidateAssessmentId}`);
}
