"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/authz";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Mirrors the same friendly-messaging in staff/people/actions.ts: Supabase's
// per-email cooldown and its project-wide send-volume cap are both normal,
// expected conditions, not app failures -- and "Copy invite link" (People &
// Access) sidesteps both since it never touches the mailer.
function friendlyInviteError(raw: string): string {
  const cooldown = raw.match(/after (\d+) seconds?/i);
  if (cooldown) {
    return `Supabase's per-email cooldown is still active (wait ${cooldown[1]}s to resend by email) — or use "Copy invite link" in People & Access to skip the wait.`;
  }
  if (/rate limit/i.test(raw)) {
    return `Supabase's shared email sending limit is temporarily exhausted — use "Copy invite link" in People & Access instead of waiting it out.`;
  }
  return raw;
}

export async function createAssessment(formData: FormData) {
  await requireStaff();
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
  await requireStaff();
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
  await requireStaff();
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
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("assessments").update({ status: "published" }).eq("id", assessmentId);
  revalidatePath(`/staff/builder/${assessmentId}`);
}

export async function inviteCandidate(assessmentId: string, formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const department = String(formData.get("department") || "").trim() || null;
  const jobTitle = String(formData.get("job_title") || "").trim() || null;

  if (!email) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent("Email is required."));
  }

  // Accounts are invite-only: provision the candidate if they don't already exist,
  // then send them a real "set your password" email — no self-signup required.
  const { data: provisioned, error: provisionError } = await supabase.rpc("admin_provision_user", {
    p_email: email,
    p_full_name: fullName || email.split("@")[0],
    p_role: "candidate",
    p_department: department,
  });

  if (provisionError) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent(provisionError.message));
  }

  const candidateId = provisioned?.[0]?.profile_id as string | undefined;
  const wasCreated = provisioned?.[0]?.created as boolean | undefined;

  if (!candidateId) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent("Could not provision candidate."));
  }

  // Division/position apply to the person's profile itself (shared across all
  // their assessments), so keep them in sync here regardless of whether this
  // call created a brand-new profile or matched an existing one.
  if (department || jobTitle) {
    await supabase
      .from("profiles")
      .update({ ...(department ? { department } : {}), ...(jobTitle ? { job_title: jobTitle } : {}) })
      .eq("id", candidateId as string);
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
  const { error: mailError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site}/invite/callback` });

  revalidatePath(`/staff/builder/${assessmentId}`);
  revalidatePath("/staff/people");
  void wasCreated;

  if (mailError) {
    redirect(
      `/staff/builder/${assessmentId}?error=` +
        encodeURIComponent(`${fullName || email} was added to the assessment, but the invite email failed to send. ${friendlyInviteError(mailError.message)}`)
    );
  }
  redirect(`/staff/builder/${assessmentId}?added=` + encodeURIComponent(`${fullName || email} was invited.`));
}

// Assigns an already-existing profile (any role) to this assessment without
// creating a new account or sending an auth email -- they already have one.
// Notified in-app instead, since that doesn't depend on outbound mail at all.
export async function assignExistingCandidate(assessmentId: string, formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const profileId = String(formData.get("profile_id") || "").trim();

  if (!profileId) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent("Choose a person first."));
  }

  const { error: linkError } = await supabase.from("candidate_assessments").insert({
    assessment_id: assessmentId,
    candidate_id: profileId,
    status: "invited",
  });

  if (linkError) {
    redirect(
      `/staff/builder/${assessmentId}?error=` +
        encodeURIComponent(linkError.message.includes("duplicate") ? "This person is already assigned to this assessment." : linkError.message)
    );
  }

  const [{ data: assessment }, { data: profile }] = await Promise.all([
    supabase.from("assessments").select("title").eq("id", assessmentId).single(),
    supabase.from("profiles").select("full_name").eq("id", profileId).single(),
  ]);

  await supabase.from("notifications").insert({
    user_id: profileId,
    title: "New assessment assigned",
    body: `You've been assigned "${assessment?.title || "an assessment"}". Log in to take it.`,
    link: "/candidate/assessments",
  });

  revalidatePath(`/staff/builder/${assessmentId}`);
  revalidatePath("/staff/people");
  redirect(`/staff/builder/${assessmentId}?added=` + encodeURIComponent(`${profile?.full_name || "Person"} was assigned this assessment.`));
}

export async function updateProctoringSettings(assessmentId: string, formData: FormData) {
  await requireStaff();
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

async function requireAdminForGeneration() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile || (profile.role !== "hr_admin" && profile.role !== "system_admin")) {
    redirect("/staff/builder?error=" + encodeURIComponent("Only HR admins and the super admin can generate assessments."));
  }
  return { supabase, userId: user.id, fullName: profile.full_name as string };
}

function engineDisplayName(engine: "claude" | "fugu" | "kimi"): string {
  if (engine === "claude") return "Claude";
  if (engine === "kimi") return "Kimi";
  return "Sakana Fugu";
}

async function loadEngine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  engineKey: "claude" | "fugu" | "kimi"
) {
  const { data: engine } = await supabase
    .from("generation_engines")
    .select("enabled")
    .eq("key", engineKey)
    .maybeSingle();

  // The key itself lives in Supabase Vault (encrypted at rest), not on this
  // row -- get_engine_api_key() is a SECURITY DEFINER RPC that decrypts it
  // server-side only, re-checking is_staff() independently of this call site.
  const { data: apiKey } = await supabase.rpc("get_engine_api_key", { p_engine_key: engineKey });

  if (!engine || !engine.enabled || !apiKey) {
    throw new Error(
      `The ${engineDisplayName(engineKey)} engine isn't configured. Add an API key and enable it in Settings first.`
    );
  }
  return apiKey as string;
}

// Takes competency rows the caller already fetched (avoids a second round trip
// to re-fetch the same rows) and attaches their behavioral indicators.
async function loadCompetenciesForPrompt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  comps: { id: string; code: string; name: string; category: string; description: string | null }[]
): Promise<import("@/lib/generation").CompetencyForPrompt[]> {
  const competencyIds = comps.map((c) => c.id);
  const { data: indicators } = await supabase
    .from("competency_indicators")
    .select("competency_id, level, indicator_text")
    .in("competency_id", competencyIds);

  return comps.map((c) => ({
    code: c.code,
    name: c.name,
    category: c.category,
    description: c.description,
    indicators: (indicators || [])
      .filter((i) => i.competency_id === c.id)
      .map((i) => ({ level: i.level, indicator_text: i.indicator_text })),
  }));
}

async function insertGeneratedAssessment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    title: string;
    description: string;
    mode: "default_core" | "default_leadership" | "default_mix" | "generated";
    engine: "claude" | "fugu" | "kimi";
    generatedBy: string;
    competencies: { id: string; code: string; name: string }[];
    generated: import("@/lib/generation").GeneratedAssessment;
  }
) {
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();

  const totalQuestions = params.generated.sections.reduce((n, s) => n + s.questions.length, 0);
  const timeLimitMinutes = Math.max(20, totalQuestions * 5);

  const { data: assessment, error } = await supabase
    .from("assessments")
    .insert({
      organization_id: org?.id,
      title: params.title,
      description: params.description,
      time_limit_minutes: timeLimitMinutes,
      created_by: params.generatedBy,
      status: "draft",
      mode: params.mode,
      engine: params.engine,
      generated_by: params.generatedBy,
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !assessment) throw new Error(error?.message || "Failed to create the generated assessment.");

  // Bulk-insert every section in a single round trip, then every question in
  // another single round trip, instead of one insert per row — a generated
  // assessment with, say, 5 sections and 15 questions used to take 20
  // sequential network round trips to Supabase; this cuts it to 2.
  const sectionRowsToInsert = params.generated.sections.map((section, i) => {
    const comp = params.competencies.find((c) => c.code === section.competencyCode);
    return {
      assessment_id: assessment.id,
      title: comp?.name || section.competencyCode,
      competency_id: comp?.id || null,
      sequence: i + 1,
    };
  });

  const { data: insertedSections, error: sectionsError } = await supabase
    .from("assessment_sections")
    .insert(sectionRowsToInsert)
    .select("id");

  if (sectionsError || !insertedSections) {
    throw new Error(sectionsError?.message || "Failed to create the assessment's sections.");
  }

  const questionRowsToInsert = params.generated.sections.flatMap((section, i) => {
    const comp = params.competencies.find((c) => c.code === section.competencyCode);
    const sectionId = insertedSections[i]?.id;
    if (!sectionId) return [];
    return section.questions.map((q, qi) => {
      const options =
        q.type === "mcq" && q.options
          ? q.options.map((o, oi) => ({ key: String.fromCharCode(65 + oi), text: o.text, correct: !!o.correct }))
          : null;
      return {
        section_id: sectionId,
        question_type: q.type,
        prompt: q.prompt,
        options,
        competency_id: comp?.id || null,
        weight: 1,
        sequence: qi + 1,
      };
    });
  });

  if (questionRowsToInsert.length > 0) {
    const { error: questionsError } = await supabase.from("questions").insert(questionRowsToInsert);
    if (questionsError) throw new Error(questionsError.message || "Failed to create the assessment's questions.");
  }

  return assessment.id as string;
}

export async function generateDefaultAssessment(category: "Core" | "Leadership" | "Mix", formData: FormData) {
  const { generateAssessmentContent } = await import("@/lib/generation");
  const { supabase, userId, fullName } = await requireAdminForGeneration();

  const engineKey = String(formData.get("engine") || "") as "claude" | "fugu" | "kimi";
  const customTitle = String(formData.get("title") || "").trim();

  if (engineKey !== "claude" && engineKey !== "fugu" && engineKey !== "kimi") {
    redirect("/staff/builder?error=" + encodeURIComponent("Choose a generation engine."));
  }

  let newId: string;
  try {
    const categories = category === "Mix" ? ["Core", "Leadership"] : [category];
    // Fetch the competency rows and validate/load the engine's API key concurrently —
    // these two reads don't depend on each other, so there's no reason to serialize them.
    const [{ data: comps }, apiKey] = await Promise.all([
      supabase.from("competencies").select("id, code, name, category, description").in("category", categories),
      loadEngine(supabase, engineKey),
    ]);

    if (!comps || comps.length === 0) {
      throw new Error(`No ${category} competencies found in the library.`);
    }

    const competencies = await loadCompetenciesForPrompt(supabase, comps);
    const generated = await generateAssessmentContent(engineKey, apiKey, competencies);

    const modeMap = { Core: "default_core", Leadership: "default_leadership", Mix: "default_mix" } as const;
    const labelMap = { Core: "Core", Leadership: "Leadership", Mix: "Core + Leadership (mixed)" } as const;

    newId = await insertGeneratedAssessment(supabase, {
      title: customTitle || `${labelMap[category]} Competency Assessment (Default) — ${new Date().toLocaleDateString()}`,
      description: `System-generated default assessment covering all ${labelMap[category]} competencies, by ${fullName}, via ${engineDisplayName(engineKey)}.`,
      mode: modeMap[category],
      engine: engineKey,
      generatedBy: userId,
      competencies: comps,
      generated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed.";
    redirect("/staff/builder?error=" + encodeURIComponent(message));
  }

  revalidatePath("/staff/builder");
  redirect(`/staff/builder/${newId}`);
}

export async function deleteAssessment(assessmentId: string) {
  const { supabase } = await requireAdminForGeneration();
  const { error } = await supabase.from("assessments").delete().eq("id", assessmentId);
  if (error) redirect("/staff/builder?error=" + encodeURIComponent(error.message));
  revalidatePath("/staff/builder");
  redirect("/staff/builder");
}

export async function updateAssessmentMeta(assessmentId: string, formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const timeLimit = Number(formData.get("time_limit_minutes") || 60);

  if (!title) redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent("Title can't be empty."));

  const { error } = await supabase
    .from("assessments")
    .update({ title, description, time_limit_minutes: timeLimit })
    .eq("id", assessmentId);

  if (error) redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent(error.message));

  revalidatePath(`/staff/builder/${assessmentId}`);
  revalidatePath("/staff/builder");
}

export async function deleteSection(sectionId: string, assessmentId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("assessment_sections").delete().eq("id", sectionId);
  if (error) redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent(error.message));
  revalidatePath(`/staff/builder/${assessmentId}`);
}

export async function deleteQuestion(questionId: string, sectionId: string, assessmentId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("questions").delete().eq("id", questionId);
  if (error) redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent(error.message));
  revalidatePath(`/staff/builder/${assessmentId}`);
  void sectionId;
}

export async function generateCustomAssessment(formData: FormData) {
  const { generateAssessmentContent } = await import("@/lib/generation");
  const { supabase, userId, fullName } = await requireAdminForGeneration();

  const title = String(formData.get("title") || "").trim();
  const engineKey = String(formData.get("engine") || "") as "claude" | "fugu" | "kimi";
  const competencyIds = formData.getAll("competency_ids") as string[];

  if (!title) redirect("/staff/builder?error=" + encodeURIComponent("Give the generated assessment a title."));
  if (engineKey !== "claude" && engineKey !== "fugu" && engineKey !== "kimi") {
    redirect("/staff/builder?error=" + encodeURIComponent("Choose a generation engine."));
  }
  if (competencyIds.length === 0) {
    redirect("/staff/builder?error=" + encodeURIComponent("Select at least one competency to generate from."));
  }

  let newId: string;
  try {
    const [apiKey, { data: comps }] = await Promise.all([
      loadEngine(supabase, engineKey),
      supabase.from("competencies").select("id, code, name, category, description").in("id", competencyIds),
    ]);
    const competencies = await loadCompetenciesForPrompt(supabase, comps || []);
    const generated = await generateAssessmentContent(engineKey, apiKey, competencies);

    newId = await insertGeneratedAssessment(supabase, {
      title,
      description: `Generated by ${fullName} using ${engineDisplayName(engineKey)}.`,
      mode: "generated",
      engine: engineKey,
      generatedBy: userId,
      competencies: comps || [],
      generated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed.";
    redirect("/staff/builder?error=" + encodeURIComponent(message));
  }

  revalidatePath("/staff/builder");
  redirect(`/staff/builder/${newId}`);
}
