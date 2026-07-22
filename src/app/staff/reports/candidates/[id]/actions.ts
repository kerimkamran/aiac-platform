"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

  revalidatePath(`/staff/reports/candidates/${candidateAssessmentId}`);
}

export async function requestManagerSignoff(candidateAssessmentId: string) {
  await requireRole(...STAFF_ROLES);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select("id, assessments(title), candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, manager_id)")
    .eq("id", candidateAssessmentId)
    .single();

  const candidate = ca?.candidate as unknown as { full_name: string; manager_id: string | null } | null;
  const assessment = ca?.assessments as unknown as { title: string } | null;
  if (!candidate?.manager_id) {
    revalidatePath(`/staff/reports/candidates/${candidateAssessmentId}`);
    return;
  }

  await supabase.from("promotion_signoffs").insert({
    candidate_assessment_id: candidateAssessmentId,
    requested_by: user!.id,
    manager_id: candidate.manager_id,
    status: "pending",
  });

  await supabase.from("notifications").insert({
    user_id: candidate.manager_id,
    title: "Promotion sign-off requested",
    body: `Your input is requested on ${candidate.full_name}'s promotion review for "${assessment?.title || "an assessment"}".`,
    link: `/candidate/signoffs`,
  });

  revalidatePath(`/staff/reports/candidates/${candidateAssessmentId}`);
}

export async function deleteProctoringRecording(candidateAssessmentId: string, recordingId: string, storagePath: string | null) {
  await requireRole(...STAFF_ROLES);
  const supabase = await createClient();

  if (storagePath) {
    await supabase.storage.from("proctoring").remove([storagePath]);
  }
  await supabase.from("proctoring_recordings").update({ deleted_at: new Date().toISOString() }).eq("id", recordingId);

  revalidatePath(`/staff/reports/candidates/${candidateAssessmentId}`);
}

// Releases the developmental feedback view to the candidate (Phase 2).
// Admin-only: this is a deliberate, auditable act -- candidates always see
// their scores once reviewed, but the growth-framed feedback narrative only
// appears after an admin decides the process is complete.
export async function releaseFeedback(candidateAssessmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["hr_admin", "system_admin"].includes(profile.role)) {
    redirect(`/staff/reports/candidates/${candidateAssessmentId}?error=` + encodeURIComponent("Only admins can release feedback."));
  }

  const { error } = await supabase
    .from("candidate_assessments")
    .update({ feedback_released_at: new Date().toISOString() })
    .eq("id", candidateAssessmentId);

  if (error) {
    redirect(`/staff/reports/candidates/${candidateAssessmentId}?error=` + encodeURIComponent(error.message));
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: user.id,
    action: "feedback_released",
    details: { candidate_assessment_id: candidateAssessmentId },
  });

  revalidatePath(`/staff/reports/candidates/${candidateAssessmentId}`);
}
