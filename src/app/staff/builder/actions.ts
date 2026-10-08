"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole, requireStaff } from "@/lib/authz";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertCanGenerate, AiPolicyError, type AiPolicy } from "@/lib/ai-policy";
import type { EngineKey } from "@/lib/ai-engine";
import { generateAssessmentContent, LENGTH_TOTALS, type AssessmentLength, type QuestionMix, type GenerationLanguage } from "@/lib/generation";
import { prepareContext, type ContextItem, MAX_REFERENCE_FILES, REFERENCE_FILE_MAX_CHARS } from "@/lib/ai-context";
import { LEVELS, isLevelKey, includesLeadership, type LevelKey } from "@/lib/levels";

export type AssessmentPurpose = "hiring" | "promotion" | "development";

const STAFF_ROLE_LIST = ["recruiter", "hiring_manager", "hr_admin", "org_admin", "system_admin"];

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

// Publishing goes through publish_assessment() in the database, which checks
// the questions, enforces the AI-draft rules (HR/org/system admin plus an
// explicit review confirmation) and is the only route a trigger allows.
export async function publishAssessment(assessmentId: string, formData?: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const reviewed = formData?.get("reviewed") === "on";
  const { error } = await supabase.rpc("publish_assessment", { p_assessment_id: assessmentId, p_reviewed: reviewed });
  if (error) {
    redirect(`/staff/builder/${assessmentId}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/staff/builder/${assessmentId}`);
  revalidatePath("/staff/builder");
  redirect(`/staff/builder/${assessmentId}?added=` + encodeURIComponent("Assessment published. Candidates can now be invited."));
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

type EnginePolicy = { key: string; display_name: string; enabled: boolean; configured: boolean; allow_context: boolean };

// Uses the engine the admin picked if it is valid, else the default model from
// AI Governance.
function chooseEngine(raw: string | null | undefined, fallback: EngineKey): EngineKey {
  return raw === "claude" || raw === "fugu" || raw === "kimi" ? raw : fallback;
}

// Records one AI generation attempt with its metadata (position, level, batch,
// the context that was sent, as counts and names only -- never the text). The
// quota counts these rows. The idempotency key is unique per user, so a retried
// draft gets a new key rather than generating twice under the same one.
async function startGenerationRun(
  supabase: Awaited<ReturnType<typeof createClient>>,
  run: {
    userId: string;
    engine: EngineKey;
    positionId: string | null;
    batchId: string | null;
    idempotencyKey: string | null;
    level: LevelKey;
    contextSnapshot: Record<string, unknown>;
  }
) {
  const { data, error } = await supabase
    .from("generation_runs")
    .insert({
      created_by: run.userId,
      engine: run.engine,
      status: "running",
      position_id: run.positionId,
      batch_id: run.batchId,
      idempotency_key: run.idempotencyKey,
      target_level: run.level,
      prompt_version: "v2-levels",
      context_snapshot: run.contextSnapshot,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Couldn't start the generation run. Nothing was generated.");
  return data.id as string;
}

async function finishGenerationRun(
  supabase: Awaited<ReturnType<typeof createClient>>,
  runId: string,
  outcome: { assessmentId?: string; error?: string; usage?: Record<string, unknown> }
) {
  await supabase.rpc("finish_generation_run", {
    p_run_id: runId,
    p_status: outcome.error ? "failed" : "succeeded",
    p_assessment_id: outcome.assessmentId ?? null,
    p_error: outcome.error ?? null,
    p_usage: outcome.usage ?? null,
  });
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
  // Read through the staff-safe function: generation_engines itself is
  // admin-only, so a recruiter's direct read would come back empty.
  const { data: rows } = await supabase.rpc("engine_policy_for_staff");
  const engine = ((rows || []) as EnginePolicy[]).find((e) => e.key === engineKey) ?? null;

  // The key itself lives in Supabase Vault (encrypted at rest), not on this
  // row -- get_engine_api_key() is a SECURITY DEFINER RPC that decrypts it
  // server-side only, re-checking is_staff() independently of this call site.
  const { data: apiKey } = await supabase.rpc("get_engine_api_key", { p_engine_key: engineKey });

  if (!engine || !engine.enabled || !engine.configured || !apiKey) {
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
    mode: "generated";
    engine: EngineKey;
    generatedBy: string;
    competencies: { id: string; code: string; name: string }[];
    generated: import("@/lib/generation").GeneratedAssessment;
    purpose: AssessmentPurpose;
    language: GenerationLanguage;
    positionId: string | null;
    vacancyTitle: string;
    level: LevelKey;
  }
) {
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();

  const totalQuestions = params.generated.sections.reduce((n, s) => n + s.questions.length, 0);
  const timeLimitMinutes = Math.max(20, totalQuestions * 5);
  const passMark = LEVELS[params.level].passMark;

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
      content_language: params.language,
      position_id: params.positionId,
      vacancy_title: params.vacancyTitle,
      target_level: params.level,
    })
    .select("id")
    .single();

  if (error || !assessment) throw new Error(error?.message || "Failed to create the generated assessment.");

  // Anything that fails after this point removes the half-built draft, so a
  // failed generation never leaves an assessment with missing questions.
  try {
    const sectionRowsToInsert = params.generated.sections.map((section, i) => {
      const comp = params.competencies.find((c) => c.code === section.competencyCode);
      return {
        assessment_id: assessment.id,
        title: comp?.name || section.competencyCode,
        competency_id: comp?.id || null,
        sequence: i + 1,
        target_score: passMark,
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
  } catch (e) {
    await supabase.from("assessments").delete().eq("id", assessment.id);
    throw e;
  }

  return assessment.id as string;
}

export type DraftInput = {
  batchId: string;
  // Unique per draft and attempt, e.g. "<batch>:<position>:<level>:<attempt>".
  idempotencyKey: string;
  positionId: string | null;
  positionTitle: string;
  department: string | null;
  level: LevelKey;
  purpose: AssessmentPurpose;
  language: GenerationLanguage;
  competencyIds: string[];
  length: AssessmentLength;
  mix: QuestionMix;
  engine: EngineKey | null;
  instructions: string;
  jobDescription: string;
  notes: string;
  // Reference files saved on the position (saved again when saveContext is on).
  files: { name: string; text: string }[];
  // One-off files for this batch only. They are sent but never saved.
  oneOffFiles: { name: string; text: string }[];
  saveContext: boolean;
  // Create a draft with no questions (for staff without AI access).
  emptyDraft: boolean;
};

export type DraftResult =
  | { ok: true; assessmentId: string; warnings: string[] }
  | { ok: false; error: string; emptyDraftAllowed: boolean };

// Finds or creates the position a draft belongs to, and (when asked) saves its
// job description, notes and reference files for next time.
async function resolvePosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  input: DraftInput
): Promise<string> {
  const title = input.positionTitle.trim();
  let positionId = input.positionId;
  if (!positionId) {
    const { data: existing } = await supabase
      .from("positions")
      .select("id")
      .ilike("title", title)
      .is("archived_at", null)
      .maybeSingle();
    positionId = existing?.id ?? null;
  }
  if (!positionId) {
    const { data: created, error } = await supabase
      .from("positions")
      .insert({ title, department: input.department, default_level: input.level, created_by: userId, updated_by: userId })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message || "Couldn't create the position.");
    positionId = created.id as string;
  }

  if (input.saveContext) {
    await supabase
      .from("positions")
      .update({
        department: input.department,
        job_description: input.jobDescription,
        notes: input.notes,
        default_level: input.level,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", positionId);
    await supabase.from("position_files").delete().eq("position_id", positionId);
    if (input.files.length > 0) {
      await supabase.from("position_files").insert(
        input.files.map((f) => ({
          position_id: positionId,
          filename: f.name.slice(0, 120),
          content_text: f.text,
          size_bytes: new TextEncoder().encode(f.text).length,
          created_by: userId,
        }))
      );
    }
  }
  return positionId as string;
}

// One draft per call. The client calls this once per (position, level)
// combination, at most two at a time, so each draft shows its own progress and
// can be retried without redoing the others.
export async function generateDraft(input: DraftInput): Promise<DraftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active" || !STAFF_ROLE_LIST.includes(profile.role)) {
    return { ok: false, error: "Not authorized.", emptyDraftAllowed: false };
  }

  const title = input.positionTitle.trim();
  if (title.length < 2) return { ok: false, error: "Choose or type a position first.", emptyDraftAllowed: false };
  if (!isLevelKey(input.level)) return { ok: false, error: "Choose a level.", emptyDraftAllowed: false };
  if (input.competencyIds.length === 0) return { ok: false, error: "Choose at least one competency.", emptyDraftAllowed: false };

  // Governance runs before anything is written or sent to an engine.
  let policy: AiPolicy | null = null;
  if (!input.emptyDraft) {
    try {
      policy = await assertCanGenerate(supabase, profile.role, 1);
    } catch (e) {
      const message = e instanceof AiPolicyError ? e.message : "Generation isn't available right now.";
      return { ok: false, error: message, emptyDraftAllowed: true };
    }
  }

  // A key that already succeeded returns the draft it made, so a double click
  // or a retried request cannot create two drafts.
  if (input.idempotencyKey) {
    const { data: done } = await supabase
      .from("generation_runs")
      .select("assessment_id, status")
      .eq("created_by", user.id)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (done?.status === "succeeded" && done.assessment_id) {
      return { ok: true, assessmentId: done.assessment_id, warnings: [] };
    }
    if (done?.status === "running") {
      return { ok: false, error: "This draft is already being generated. Wait for it to finish.", emptyDraftAllowed: false };
    }
  }

  let positionId: string;
  try {
    positionId = await resolvePosition(supabase, user.id, input);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't save the position.", emptyDraftAllowed: false };
  }

  const levelLabel = LEVELS[input.level].label;
  const draftTitle = `${title} — ${levelLabel}`;

  if (input.emptyDraft) {
    try {
      const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
      const { data: created, error } = await supabase
        .from("assessments")
        .insert({
          organization_id: org?.id,
          title: draftTitle,
          description: "",
          time_limit_minutes: 60,
          created_by: user.id,
          status: "draft",
          purpose: input.purpose,
          content_language: input.language,
          position_id: positionId,
          vacancy_title: title,
          target_level: input.level,
        })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message || "Couldn't create the draft.");
      revalidatePath("/staff/builder");
      return { ok: true, assessmentId: created.id as string, warnings: [] };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Couldn't create the draft.", emptyDraftAllowed: false };
    }
  }

  const engineKey = chooseEngine(input.engine, policy!.defaultEngine);

  // Consent: an engine that isn't approved for context gets competencies and
  // level only. The draft still generates, and the brief card says so.
  const { data: engineRows } = await supabase.rpc("engine_policy_for_staff");
  const contextAllowed = ((engineRows || []) as EnginePolicy[]).some((e) => e.key === engineKey && e.allow_context === true);
  const hadContext = !!(input.instructions || input.jobDescription || input.notes || input.files.length + input.oneOffFiles.length > 0);

  const warnings: string[] = [];
  const allFiles = [...input.files, ...input.oneOffFiles];
  if (allFiles.length > MAX_REFERENCE_FILES) {
    return { ok: false, error: `Attach at most ${MAX_REFERENCE_FILES} reference files.`, emptyDraftAllowed: false };
  }
  if (allFiles.some((f) => f.text.length > REFERENCE_FILE_MAX_CHARS)) {
    return { ok: false, error: "A reference file is larger than 200 KB.", emptyDraftAllowed: false };
  }
  let prepared: ReturnType<typeof prepareContext>;
  try {
    prepared = prepareContext({
      instructions: contextAllowed ? input.instructions : "",
      jobDescription: contextAllowed ? input.jobDescription : "",
      notes: contextAllowed ? input.notes : "",
      files: contextAllowed ? allFiles : [],
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The context couldn't be prepared.", emptyDraftAllowed: false };
  }
  if (!contextAllowed && hadContext) {
    warnings.push(`${engineDisplayName(engineKey)} isn't approved for job descriptions or files, so this draft was generated from the competencies and level only.`);
  }
  if (prepared.trimmed.length > 0) warnings.push(`Trimmed to fit the context limit: ${prepared.trimmed.join(", ")}.`);
  if (prepared.redaction.emails + prepared.redaction.phones > 0) {
    warnings.push(`Removed ${prepared.redaction.emails} e-mail address(es) and ${prepared.redaction.phones} phone number(s) before sending.`);
  }

  const contextItems: ContextItem[] = prepared.items;
  const contextSnapshot = {
    contextSent: contextItems.length > 0,
    items: contextItems.map((c) => ({ label: c.label, chars: c.text.length })),
    trimmed: prepared.trimmed,
    redaction: prepared.redaction,
  };

  let runId: string | null = null;
  try {
    const [apiKey, { data: comps }] = await Promise.all([
      loadEngine(supabase, engineKey),
      supabase.from("competencies").select("id, code, name, category, description").in("id", input.competencyIds),
    ]);
    const levelComps = (comps || []).filter((c) => includesLeadership(input.level) || c.category !== "Leadership");
    if (levelComps.length === 0) {
      throw new Error("None of the chosen competencies apply at this level. Choose at least one Core or Functional competency.");
    }

    runId = await startGenerationRun(supabase, {
      userId: user.id,
      engine: engineKey,
      positionId,
      batchId: input.batchId || null,
      idempotencyKey: input.idempotencyKey || null,
      level: input.level,
      contextSnapshot,
    });

    const competencies = await loadCompetenciesForPrompt(supabase, levelComps);
    const result = await generateAssessmentContent(engineKey, apiKey, competencies, {
      language: input.language,
      level: input.level,
      purpose: input.purpose,
      questionTotal: LENGTH_TOTALS[input.length],
      mix: input.mix,
      position: { title, department: input.department },
      context: contextItems,
    });
    if (result.report.droppedQuestions > 0) {
      warnings.push(`${result.report.droppedQuestions} question(s) were rejected as invalid and left out.`);
    }

    const newId = await insertGeneratedAssessment(supabase, {
      title: draftTitle,
      description: "",
      mode: "generated",
      engine: engineKey,
      generatedBy: user.id,
      competencies: levelComps,
      generated: result.assessment,
      purpose: input.purpose,
      language: input.language,
      positionId,
      vacancyTitle: title,
      level: input.level,
    });
    await finishGenerationRun(supabase, runId, {
      assessmentId: newId,
      usage: { ...result.usage, dropped: result.report.droppedQuestions },
    });
    revalidatePath("/staff/builder");
    return { ok: true, assessmentId: newId, warnings };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed.";
    if (runId) await finishGenerationRun(supabase, runId, { error: message });
    return { ok: false, error: message, emptyDraftAllowed: true };
  }
}

export async function deleteAssessment(assessmentId: string) {
  await requireRole("hr_admin", "system_admin");
  const supabase = await createClient();
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

// Design-execution-plan Phase 5 / T5.3: there was no reorder capability at
// all before this -- only add and delete, so fixing a section or question
// order meant deleting and re-adding everything after the mistake. These
// swap this row's `sequence` with its immediate neighbor's rather than
// renumbering the whole list, which keeps every other row's sequence
// untouched (and the two updates are trivially safe to run in either order,
// since a swap can't collide with any sequence outside the pair). Keyboard-
// operable up/down controls only -- no drag reordering, per the plan's
// explicit WCAG 2.5.7 note that a drag path must never be the only one.
async function moveRow(
  table: "assessment_sections" | "questions",
  parentColumn: "assessment_id" | "section_id",
  parentId: string,
  rowId: string,
  direction: "up" | "down"
) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from(table)
    .select("id, sequence")
    .eq(parentColumn, parentId)
    .order("sequence");
  const ordered = (rows || []) as { id: string; sequence: number }[];
  const idx = ordered.findIndex((r) => r.id === rowId);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapWith < 0 || swapWith >= ordered.length) return; // already at an edge -- no-op

  const a = ordered[idx];
  const b = ordered[swapWith];
  await Promise.all([
    supabase.from(table).update({ sequence: b.sequence }).eq("id", a.id),
    supabase.from(table).update({ sequence: a.sequence }).eq("id", b.id),
  ]);
}

export async function moveSection(sectionId: string, assessmentId: string, direction: "up" | "down") {
  await requireStaff();
  await moveRow("assessment_sections", "assessment_id", assessmentId, sectionId, direction);
  revalidatePath(`/staff/builder/${assessmentId}`);
}

export async function moveQuestion(questionId: string, sectionId: string, assessmentId: string, direction: "up" | "down") {
  await requireStaff();
  await moveRow("questions", "section_id", sectionId, questionId, direction);
  revalidatePath(`/staff/builder/${assessmentId}`);
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

  // Drafts are never assigned: candidates would see an unreviewed test.
  const { data: target } = await supabase.from("assessments").select("status").eq("id", assessmentId).maybeSingle();
  if (!target || target.status !== "published") {
    redirect("/staff/builder?error=" + encodeURIComponent("Publish the assessment before assigning it."));
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
    // Every section on the page has its own "Set target" form sharing the
    // same input name, so the field id needs the section id folded in --
    // otherwise the message would show up next to every section's target
    // input instead of just the one that was actually submitted.
    redirect(
      `/staff/builder/${assessmentId}?error=` +
        encodeURIComponent("Target must be a number from 0 to 100.") +
        `&field=target_score-${sectionId}`
    );
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
      content_language: source.content_language,
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
