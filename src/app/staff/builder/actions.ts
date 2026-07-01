"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createAssessment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();

  const title = String(formData.get("title") || "");
  const description = String(formData.get("description") || "");
  const timeLimit = Number(formData.get("time_limit_minutes") || 60);

  const { data, error } = await supabase
    .from("assessments")
    .insert({
      organization_id: org?.id,
      title,
      description,
      time_limit_minutes: timeLimit,
      created_by: user!.id,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) redirect("/staff/builder?error=" + encodeURIComponent(error?.message || "Failed"));
  redirect(`/staff/builder/${data.id}`);
}

export async function addSection(assessmentId: string, formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") || "");
  const competencyId = String(formData.get("competency_id") || "");

  const { count } = await supabase
    .from("assessment_sections")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId);

  await supabase.from("assessment_sections").insert({
    assessment_id: assessmentId,
    title,
    competency_id: competencyId || null,
    sequence: (count || 0) + 1,
  });

  revalidatePath(`/staff/builder/${assessmentId}`);
}

export async function addQuestion(sectionId: string, assessmentId: string, formData: FormData) {
  const supabase = await createClient();

  const questionType = String(formData.get("question_type") || "text");
  const prompt = String(formData.get("prompt") || "");
  const competencyId = String(formData.get("competency_id") || "");
  const weight = Number(formData.get("weight") || 1);

  let options = null;
  if (questionType === "mcq") {
    const optTexts = formData.getAll("option_text") as string[];
    const correctIndex = Number(formData.get("correct_option") || 0);
    options = optTexts
      .map((t, i) => ({ key: String.fromCharCode(65 + i), text: t.trim(), correct: i === correctIndex }))
      .filter((o) => o.text.length > 0);
  }

  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("section_id", sectionId);

  await supabase.from("questions").insert({
    section_id: sectionId,
    question_type: questionType,
    prompt,
    options,
    competency_id: competencyId || null,
    weight,
    sequence: (count || 0) + 1,
  });

  revalidatePath(`/staff/builder/${assessmentId}`);
}

export async function publishAssessment(assessmentId: string) {
  const supabase = await createClient();
  await supabase.from("assessments").update({ status: "published" }).eq("id", assessmentId);
  revalidatePath(`/staff/builder/${assessmentId}`);
}

export async function inviteCandidate(assessmentId: string, formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") || "").trim().toLowerCase();

  const { data: candidate } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .single();

  if (!candidate) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent("No candidate account found for that email. They must sign up first."));
  }

  await supabase.from("candidate_assessments").insert({
    assessment_id: assessmentId,
    candidate_id: candidate!.id,
    status: "invited",
  });

  revalidatePath(`/staff/builder/${assessmentId}`);
}
