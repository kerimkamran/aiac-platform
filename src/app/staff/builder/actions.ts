"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/authz";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type AssessmentPurpose = "hiring" | "promotion" | "development";

function normalizePurpose(raw: FormDataEntryValue | null): AssessmentPurpose {
  return raw === "promotion" || raw === "development" ? raw : "hiring";
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
  const purpose = normalizePurpose(formData.get("purpose"));

  const { data, error } = await supabase
    .from("assessments")
    .insert({
      organization_id: org?.id,
      title,
      description,
      time_limit_minutes: timeLimit,
      created_by: user!.id,
      status: "draft",
      purpose,
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

// Imports one or more Case Library entries directly as questions in this
// section -- cases are already validated, methodology-grounded scenario
// questions (scenario_text + question_stem + options), so this is a direct
// insert rather than a second AI-generation pass. The case's scenario_text
// (context) is prepended to its question_stem to form the question prompt,
// so the scenario reads inline with the question the way the case-library
// preview shows it. RLS on case_library allows any is_staff() role to read
// it (see case_library "cases staff" policy), so this only needs
// requireStaff(), not the case-library page's stricter system_admin gate --
// that stricter gate is an app-layer choice specific to browsing/managing
// the raw library, not a data-access restriction.
export async function addQuestionsFromCases(sectionId: string, assessmentId: string, formData: FormData) {
  await requireStaff();
  const supabase = await createClient();

  const caseIds = (formData.getAll("case_id") as string[]).filter(Boolean);
  if (caseIds.length === 0) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent("Choose at least one case first."));
  }

  const { data: cases, error } = await supabase
    .from("case_library")
    .select("id, competency_id, scenario_text, question_stem, question_type, options")
    .in("id", caseIds);

  if (error || !cases || cases.length === 0) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent(error?.message || "Couldn't load the selected cases."));
  }

  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("section_id", sectionId);

  let nextSequence = (count || 0) + 1;
  const rows = (cases || []).map((c) => {
    const prompt = c.scenario_text ? `${c.scenario_text}\n\n${c.question_stem || ""}`.trim() : c.question_stem || "";
    const rawOptions = (c.options as { text?: unknown; correct?: unknown }[] | null) || null;
    // case_library.options is {text, correct} (no letter key) -- questions.options
    // needs the {key, text, correct} shape the runner/scoring expects, so the
    // A/B/C/D key is assigned here on import.
    const options =
      c.question_type === "mcq" && rawOptions
        ? rawOptions.map((o, i) => ({
            key: String.fromCharCode(65 + i),
            text: typeof o.text === "string" ? o.text : "",
            correct: !!o.correct,
          }))
        : null;
    return {
      section_id: sectionId,
      question_type: c.question_type || "text",
      prompt,
      options,
      competency_id: c.competency_id,
      weight: 1,
      sequence: nextSequence++,
    };
  });

  const { error: insertError } = await supabase.from("questions").insert(rows);
  if (insertError) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent(insertError.message));
  }

  revalidatePath(`/staff/builder/${assessmentId}`);
  redirect(`/staff/builder/${assessmentId}?added=` + encodeURIComponent(`${rows.length} question${rows.length > 1 ? "s" : ""} added from the Case Library.`));
}

export async function publishAssessment(assessmentId: string) {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("assessments").update({ status: "published" }).eq("id", assessmentId);
  revalidatePath(`/staff/builder/${assessmentId}`);
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
    purpose: AssessmentPurpose;
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
      purpose: params.purpose,
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
  const purpose = normalizePurpose(formData.get("purpose"));
  const langRaw = String(formData.get("language") || "en");
  const language = (langRaw === "az" || langRaw === "ru" ? langRaw : "en") as "en" | "az" | "ru";

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
    const generated = await generateAssessmentContent(engineKey, apiKey, competencies, language);

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
      purpose,
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
  const langRaw = String(formData.get("language") || "en");
  const language = (langRaw === "az" || langRaw === "ru" ? langRaw : "en") as "en" | "az" | "ru";
  const competencyIds = formData.getAll("competency_ids") as string[];
  const purpose = normalizePurpose(formData.get("purpose"));

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
    const generated = await generateAssessmentContent(engineKey, apiKey, competencies, language);

    newId = await insertGeneratedAssessment(supabase, {
      title,
      description: `Generated by ${fullName} using ${engineDisplayName(engineKey)}.`,
      mode: "generated",
      engine: engineKey,
      generatedBy: userId,
      competencies: comps || [],
      generated,
      purpose,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed.";
    redirect("/staff/builder?error=" + encodeURIComponent(message));
  }

  revalidatePath("/staff/builder");
  redirect(`/staff/builder/${newId}`);
}

// Lets staff assign an assessment (draft or published) to any existing account
// (candidate, decision maker, staff, admin) directly from its row in the
// Builder list -- an alternative to the candidate-only "Add a candidate"
// flow in People & Access, for cases where the account already exists
// and just needs this assessment attached.
export async function assignAssessment(assessmentId: string, formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const userId = String(formData.get("user_id") || "").trim();

  if (!userId) {
    redirect("/staff/builder?error=" + encodeURIComponent("Choose someone to assign this to."));
  }

  // No DB-level uniqueness on (assessment_id, candidate_id), so check first
  // rather than rely on an insert error -- keeps repeated clicks idempotent
  // (same person already has this exact assessment) instead of creating
  // duplicate rows silently.
  const { data: existing } = await supabase
    .from("candidate_assessments")
    .select("id")
    .eq("assessment_id", assessmentId)
    .eq("candidate_id", userId)
    .maybeSingle();

  if (existing) {
    redirect("/staff/builder?added=" + encodeURIComponent("Already assigned to that assessment."));
  }

  // Optional deadline: date-only input, stored as end-of-day UTC so the
  // candidate has the full final day.
  const dueDateRaw = String(formData.get("due_date") || "").trim();
  const dueAt = dueDateRaw ? new Date(`${dueDateRaw}T23:59:59Z`).toISOString() : null;

  const { error } = await supabase.from("candidate_assessments").insert({
    assessment_id: assessmentId,
    candidate_id: userId,
    status: "invited",
    due_at: dueAt,
  });

  if (error) {
    redirect("/staff/builder?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/staff/builder");
  revalidatePath("/staff/people");
  redirect("/staff/builder?added=" + encodeURIComponent("Assessment assigned."));
}

// Sets (or clears) the target competency level for one section -- the bar
// this assessment's reports compare each candidate's competency score
// against (meets / below / exceeds). Empty input clears the target.
export async function updateSectionTarget(sectionId: string, assessmentId: string, formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const raw = String(formData.get("target_score") || "").trim();
  const target = raw === "" ? null : Math.max(0, Math.min(100, Number(raw)));

  if (raw !== "" && Number.isNaN(target)) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent("Target must be a number from 0 to 100."));
  }

  const { error } = await supabase
    .from("assessment_sections")
    .update({ target_score: target })
    .eq("id", sectionId);

  if (error) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/staff/builder/${assessmentId}`);
}

// Clones an assessment -- sections (including targets), questions, weights,
// proctoring settings -- as a fresh draft. Regenerating via AI produces
// different content and burns tokens; duplicating preserves a known-good
// assessment exactly.
export async function duplicateAssessment(assessmentId: string) {
  await requireStaff();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: source }, { data: sections }, { data: proctoring }] = await Promise.all([
    supabase.from("assessments").select("*").eq("id", assessmentId).single(),
    supabase
      .from("assessment_sections")
      .select("id, title, sequence, competency_id, target_score, questions(question_type, prompt, options, competency_id, weight, sequence)")
      .eq("assessment_id", assessmentId)
      .order("sequence"),
    supabase.from("proctoring_settings").select("*").eq("assessment_id", assessmentId).maybeSingle(),
  ]);

  if (!source) redirect("/staff/builder?error=" + encodeURIComponent("Assessment not found."));

  const { data: created, error } = await supabase
    .from("assessments")
    .insert({
      organization_id: source.organization_id,
      title: `${source.title} (copy)`,
      description: source.description,
      time_limit_minutes: source.time_limit_minutes,
      created_by: user!.id,
      status: "draft",
      purpose: source.purpose,
      mode: source.mode,
      engine: source.engine,
    })
    .select("id")
    .single();

  if (error || !created) redirect("/staff/builder?error=" + encodeURIComponent(error?.message || "Couldn't duplicate."));

  for (const s of sections || []) {
    const { data: newSection, error: sErr } = await supabase
      .from("assessment_sections")
      .insert({
        assessment_id: created.id,
        title: s.title,
        sequence: s.sequence,
        competency_id: s.competency_id,
        target_score: s.target_score,
      })
      .select("id")
      .single();
    if (sErr || !newSection) continue;

    const qs = ((s.questions || []) as unknown as {
      question_type: string;
      prompt: string;
      options: unknown;
      competency_id: string | null;
      weight: number;
      sequence: number;
    }[]).map((q) => ({
      section_id: newSection.id,
      question_type: q.question_type,
      prompt: q.prompt,
      options: q.options,
      competency_id: q.competency_id,
      weight: q.weight,
      sequence: q.sequence,
    }));
    if (qs.length > 0) await supabase.from("questions").insert(qs);
  }

  if (proctoring) {
    const { id: _omit, assessment_id: _omit2, ...rest } = proctoring as Record<string, unknown>;
    await supabase.from("proctoring_settings").insert({ ...rest, assessment_id: created.id });
  }

  revalidatePath("/staff/builder");
  redirect(`/staff/builder/${created.id}`);
}

// Archives / restores an assessment. Archived assessments keep all candidate
// data but drop out of the default Builder list and can't be assigned.
export async function setAssessmentArchived(assessmentId: string, archived: boolean) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("assessments")
    .update({ status: archived ? "archived" : "draft" })
    .eq("id", assessmentId);
  if (error) redirect("/staff/builder?error=" + encodeURIComponent(error.message));
  revalidatePath("/staff/builder");
  redirect("/staff/builder?added=" + encodeURIComponent(archived ? "Assessment archived." : "Assessment restored to draft."));
}
