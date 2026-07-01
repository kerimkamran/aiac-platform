"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function submitReview(candidateAssessmentId: string, formData: FormData) {
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
