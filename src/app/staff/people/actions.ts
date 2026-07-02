"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "hr_admin" && profile.role !== "system_admin")) {
    redirect("/staff?error=" + encodeURIComponent("Only HR admins and the super admin can manage people."));
  }
  return supabase;
}

async function sendInviteEmail(supabase: Awaited<ReturnType<typeof createClient>>, email: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://insight-azerconnect.vercel.app";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/invite/callback`,
  });
}

export async function addCandidate(formData: FormData) {
  const supabase = await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const department = String(formData.get("department") || "").trim() || null;

  if (!email || !fullName) {
    redirect("/staff/people?error=" + encodeURIComponent("Name and email are required."));
  }

  const { error } = await supabase.rpc("admin_provision_user", {
    p_email: email,
    p_full_name: fullName,
    p_role: "candidate",
    p_department: department,
  });

  if (error) {
    redirect("/staff/people?error=" + encodeURIComponent(error.message));
  }

  await sendInviteEmail(supabase, email);

  revalidatePath("/staff/people");
  redirect("/staff/people?added=" + encodeURIComponent(fullName));
}

export async function addDecisionMaker(formData: FormData) {
  const supabase = await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();

  if (!email || !fullName) {
    redirect("/staff/people?error=" + encodeURIComponent("Name and email are required."));
  }

  const { error } = await supabase.rpc("admin_provision_user", {
    p_email: email,
    p_full_name: fullName,
    p_role: "decision_maker",
    p_department: null,
  });

  if (error) {
    redirect("/staff/people?error=" + encodeURIComponent(error.message));
  }

  await sendInviteEmail(supabase, email);

  revalidatePath("/staff/people");
  redirect("/staff/people?added=" + encodeURIComponent(fullName));
}

export async function resendInvite(email: string) {
  "use server";
  const supabase = await requireAdmin();
  await sendInviteEmail(supabase, email);
  revalidatePath("/staff/people");
}

export async function assignDecisionMaker(candidateAssessmentId: string, formData: FormData) {
  const supabase = await requireAdmin();
  const profileId = String(formData.get("decision_maker_id") || "");
  if (!profileId) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("candidate_decision_makers").insert({
    candidate_assessment_id: candidateAssessmentId,
    profile_id: profileId,
    assigned_by: user!.id,
  });

  revalidatePath(`/staff/candidates/${candidateAssessmentId}`);
}

export async function unassignDecisionMaker(candidateAssessmentId: string, profileId: string) {
  "use server";
  const supabase = await requireAdmin();
  await supabase
    .from("candidate_decision_makers")
    .delete()
    .eq("candidate_assessment_id", candidateAssessmentId)
    .eq("profile_id", profileId);
  revalidatePath(`/staff/candidates/${candidateAssessmentId}`);
}
