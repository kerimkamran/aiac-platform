"use server";

import { submitReview as submitReviewImpl } from "../../../staff/candidates/[id]/actions";

export async function submitReview(candidateAssessmentId: string, formData: FormData) {
  return submitReviewImpl(candidateAssessmentId, formData);
}
