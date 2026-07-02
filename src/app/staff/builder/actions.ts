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
  const fullName = String(formData.get("full_name") || "").trim();

  if (!email) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent("Email is required."));
  }

  // Accounts are invite-only: provision the candidate if they don't already exist,
  // then send them a real "set your password" email — no self-signup required.
  const { data: provisioned, error: provisionError } = await supabase.rpc("admin_provision_user", {
    p_email: email,
    p_full_name: fullName || email.split("@")[0],
    p_role: "candidate",
    p_department: null,
  });

  if (provisionError) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent(provisionError.message));
  }

  const candidateId = provisioned?.[0]?.profile_id as string | undefined;
  const wasCreated = provisioned?.[0]?.created as boolean | undefined;

  if (!candidateId) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent("Could not provision candidate."));
  }

  const { error: linkError } = await supabase.from("candidate_assessments").insert({
    assessment_id: assessmentId,
    candidate_id: candidateId,
    status: "invited",
  });

  if (linkError) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent(linkError.message.includes("duplicate") ? "This candidate is already invited to this assessment." : linkError.message));
  }

  const site = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://insight-azerconnect.vercel.app";
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site}/invite/callback` });

  revalidatePath(`/staff/builder/${assessmentId}`);
  revalidatePath("/staff/people");
  void wasCreated;
}

export async function updateProctoringSettings(assessmentId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cameraEnabled = formData.get("camera_enabled") === "on";
  const storageBackend = String(formData.get("storage_backend") || "supabase");

  await supabase.from("proctoring_settings").upsert(
    {
      assessment_id: assessmentId,
      camera_enabled: cameraEnabled,
      storage_backend: storageBackend,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "assessment_id" }
  );

  revalidatePath(`/staff/builder/${assessmentId}`);
}
