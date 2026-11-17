"use server";

import { deadlineFromDate } from "@/lib/deadline";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, STAFF_ROLES } from "@/lib/authz";
import { clampExtra } from "@/lib/exam-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeTotals } from "@/lib/score-attempt";

export async function submitReview(candidateAssessmentId: string, formData: FormData) {
  await requireRole(...STAFF_ROLES);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const decision = String(formData.get("decision") || "");
  const comment = String(formData.get("comment") || "");
  const back = `/staff/reports/candidates/${candidateAssessmentId}`;

  const { data: target } = await supabase
    .from("candidate_assessments")
    .select("status, candidate_id")
    .eq("id", candidateAssessmentId)
    .maybeSingle();
  if (!target) redirect("/staff/reports/candidates?error=" + encodeURIComponent("That assessment was not found."));

  // Nobody decides on their own assessment.
  if (target.candidate_id === user!.id) {
    redirect(`${back}?error=` + encodeURIComponent("This is your own assessment. Another reviewer needs to decide."));
  }
  // A decision needs a submitted assessment. Deciding earlier would lock the
  // candidate out of a test they have not taken yet.
  if (!["submitted", "scored", "reviewed"].includes(target.status)) {
    redirect(`${back}?error=` + encodeURIComponent("The candidate hasn't submitted yet, so a decision can't be recorded."));
  }
  if (!["shortlist", "hold", "reject"].includes(decision)) {
    redirect(`${back}?error=` + encodeURIComponent("Choose shortlist, hold or reject."));
  }

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
  // Land back on the page with a clear "saved" message and a way to the next
  // candidate waiting for a decision.
  redirect(`${back}?decided=${decision}`);
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

// Extra time for one candidate (Clear Horizon D4, migration 0018). Staff only;
// the database trigger enforces the same rule. Quietly does nothing if the
// migration has not been applied yet.
export async function setExtraTime(candidateAssessmentId: string, formData: FormData) {
  await requireRole(...STAFF_ROLES);
  const supabase = await createClient();
  const minutes = clampExtra(Number(formData.get("extra_minutes")));
  await supabase
    .from("candidate_assessments")
    .update({ extra_minutes: minutes })
    .eq("id", candidateAssessmentId)
    .in("status", ["invited", "in_progress"]);
  revalidatePath(`/staff/reports/candidates/${candidateAssessmentId}`);
}

// Move or clear one candidate's deadline (CAN-X-01). The candidate page tells
// people to ask HR for more time; this is the control behind that sentence.
export async function setDeadline(candidateAssessmentId: string, formData: FormData) {
  const staff = await requireRole(...STAFF_ROLES);
  const supabase = await createClient();
  const back = `/staff/reports/candidates/${candidateAssessmentId}`;
  const result = deadlineFromDate(String(formData.get("due_date") || ""));
  if (!result.ok) redirect(`${back}?error=` + encodeURIComponent(result.error));
  const { error } = await supabase
    .from("candidate_assessments")
    .update({ due_at: result.iso })
    .eq("id", candidateAssessmentId)
    .in("status", ["invited", "in_progress"]);
  if (error) redirect(`${back}?error=` + encodeURIComponent(error.message));
  await supabase.from("admin_audit_log").insert({
    actor_id: staff.id,
    action: "deadline_changed",
    details: { candidate_assessment_id: candidateAssessmentId, due_at: result.iso },
  });
  revalidatePath(back);
}

// A reviewer confirms (agree) or corrects (change) the score for one answer.
// Confirming clears the "needs review" flag. A change keeps the AI's score in
// ai_score, saves the reason, and recalculates the candidate's totals. Written
// with the server key because candidates' score rows are not writable by users.
export async function reviewAnswer(candidateAssessmentId: string, responseId: string, formData: FormData) {
  await requireRole(...STAFF_ROLES);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const back = `/staff/reports/candidates/${candidateAssessmentId}`;
  const fail = (m: string): never => redirect(`${back}?error=` + encodeURIComponent(m));

  const { data: target } = await supabase
    .from("candidate_assessments")
    .select("status, candidate_id")
    .eq("id", candidateAssessmentId)
    .maybeSingle();
  if (!target) fail("That assessment was not found.");
  if (target!.candidate_id === user!.id) fail("This is your own assessment. Another reviewer needs to review it.");
  if (!["scored", "reviewed"].includes(target!.status)) fail("This assessment is not ready for review yet.");

  const admin = createAdminClient();
  if (!admin) fail("Reviewing answers needs the server key to be set up. Ask your administrator.");
  const db = admin!;

  const { data: row } = await db
    .from("candidate_responses")
    .select("id, score, ai_score")
    .eq("id", responseId)
    .eq("candidate_assessment_id", candidateAssessmentId)
    .maybeSingle();
  if (!row) fail("That answer was not found.");

  const mode = String(formData.get("mode") || "agree");
  const now = new Date().toISOString();
  if (mode === "change") {
    const next = Number(formData.get("score"));
    const note = String(formData.get("note") || "").trim();
    if (!Number.isFinite(next) || next < 0 || next > 100) fail("The score must be a number from 0 to 100.");
    if (note.length < 5) fail("Say briefly why you changed the score.");
    const { error } = await db
      .from("candidate_responses")
      .update({
        ai_score: (row as { ai_score: number | null }).ai_score ?? (row as { score: number }).score,
        score: Math.round(next),
        reviewer_note: note,
        reviewed_by: user!.id,
        reviewed_at: now,
        needs_review: false,
      })
      .eq("id", responseId);
    if (error) fail("The score was not saved. Has migration 0023 been run?");
    const totals = await recomputeTotals(db, candidateAssessmentId);
    if (!totals.ok) fail(totals.error || "The totals could not be updated.");
  } else {
    const { error } = await db
      .from("candidate_responses")
      .update({ reviewed_by: user!.id, reviewed_at: now, needs_review: false })
      .eq("id", responseId);
    if (error) fail("The confirmation was not saved. Has migration 0023 been run?");
  }

  revalidatePath(back);
  redirect(`${back}?added=` + encodeURIComponent(mode === "change" ? "Score changed and totals updated." : "Score confirmed."));
}
