"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateCaseLibraryEntries } from "@/lib/case-library";
import type { CompetencyForPrompt } from "@/lib/generation";
import { parseExcelBuffer, parseStructuredText, extractCasesWithAI, type ParsedCaseRow } from "@/lib/case-upload";

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "system_admin") {
    redirect("/staff?error=" + encodeURIComponent("The case library is restricted to the super admin."));
  }
  return { supabase, userId: user.id };
}

async function loadEngineKey(supabase: Awaited<ReturnType<typeof createClient>>, engineKey: "claude" | "fugu" | "kimi") {
  const { data: engine } = await supabase
    .from("generation_engines")
    .select("enabled")
    .eq("key", engineKey)
    .maybeSingle();
  // The key lives in Supabase Vault (encrypted at rest), not on this row --
  // get_engine_api_key() decrypts it server-side, re-checking is_staff().
  const { data: apiKey } = await supabase.rpc("get_engine_api_key", { p_engine_key: engineKey });
  if (!engine || !engine.enabled || !apiKey) {
    throw new Error(`That engine isn't configured. Add an API key and enable it in Settings first.`);
  }
  return apiKey as string;
}

async function loadCompetencyForPrompt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  competencyId: string
): Promise<{ id: string; code: string; name: string; forPrompt: CompetencyForPrompt }> {
  const { data: comp } = await supabase
    .from("competencies")
    .select("id, code, name, category, description")
    .eq("id", competencyId)
    .single();
  if (!comp) throw new Error("Competency not found.");

  const { data: indicators } = await supabase
    .from("competency_indicators")
    .select("level, indicator_text")
    .eq("competency_id", competencyId);

  return {
    id: comp.id,
    code: comp.code,
    name: comp.name,
    forPrompt: {
      code: comp.code,
      name: comp.name,
      category: comp.category,
      description: comp.description,
      indicators: (indicators || []).map((i) => ({ level: i.level, indicator_text: i.indicator_text })),
    },
  };
}

async function insertCases(
  supabase: Awaited<ReturnType<typeof createClient>>,
  competencyId: string,
  engine: "claude" | "fugu" | "kimi",
  generatedBy: string,
  cases: Awaited<ReturnType<typeof generateCaseLibraryEntries>>
) {
  if (cases.length === 0) return 0;
  const rows = cases.map((c) => ({
    competency_id: competencyId,
    title: c.title,
    scenario_text: c.scenarioText,
    question_stem: c.questionStem,
    question_type: c.questionType,
    options: c.questionType === "mcq" ? c.options : null,
    difficulty: c.difficulty,
    methodology_tag: c.methodologyTag,
    methodology_notes: c.methodologyNotes,
    engine,
    generated_by: generatedBy,
  }));
  const { error } = await supabase.from("case_library").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function generateCasesForCompetency(competencyId: string, formData: FormData) {
  const { supabase, userId } = await requireSuperAdmin();
  const engine = String(formData.get("engine") || "") as "claude" | "fugu" | "kimi";
  const count = Math.max(1, Math.min(20, Number(formData.get("count") || 8)));

  if (engine !== "claude" && engine !== "fugu" && engine !== "kimi") {
    redirect("/staff/case-library?error=" + encodeURIComponent("Choose a generation engine."));
  }

  try {
    const apiKey = await loadEngineKey(supabase, engine);
    const { forPrompt } = await loadCompetencyForPrompt(supabase, competencyId);
    const cases = await generateCaseLibraryEntries(engine, apiKey, forPrompt, count);
    await insertCases(supabase, competencyId, engine, userId, cases);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed.";
    redirect("/staff/case-library?error=" + encodeURIComponent(message));
  }

  revalidatePath("/staff/case-library");
}

export async function generateCasesForAllCompetencies(formData: FormData) {
  const { supabase, userId } = await requireSuperAdmin();
  const engine = String(formData.get("engine") || "") as "claude" | "fugu" | "kimi";
  const count = Math.max(1, Math.min(20, Number(formData.get("count") || 6)));

  if (engine !== "claude" && engine !== "fugu" && engine !== "kimi") {
    redirect("/staff/case-library?error=" + encodeURIComponent("Choose a generation engine."));
  }

  try {
    const apiKey = await loadEngineKey(supabase, engine);
    const { data: competencies } = await supabase.from("competencies").select("id").order("category").order("name");
    const ids = (competencies || []).map((c) => c.id);

    // Bounded concurrency: run a handful of competencies at a time rather than
    // fully sequential (slow) or fully parallel (risks rate limits on a 37-item run).
    const BATCH_SIZE = 8;
    let totalInserted = 0;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batchIds.map(async (id) => {
          try {
            const { forPrompt } = await loadCompetencyForPrompt(supabase, id);
            const cases = await generateCaseLibraryEntries(engine, apiKey, forPrompt, count);
            return await insertCases(supabase, id, engine, userId, cases);
          } catch {
            return 0; // one competency failing shouldn't abort the whole batch run
          }
        })
      );
      totalInserted += results.reduce((a, b) => a + b, 0);
    }
    void totalInserted;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed.";
    redirect("/staff/case-library?error=" + encodeURIComponent(message));
  }

  revalidatePath("/staff/case-library");
}

export async function deleteCase(caseId: string) {
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.from("case_library").delete().eq("id", caseId);
  if (error) redirect("/staff/case-library?error=" + encodeURIComponent(error.message));
  revalidatePath("/staff/case-library");
}


/* ---------------- Manual upload (Excel / Word / plain text / Markdown) ---------------- */

const EXCEL_EXTENSIONS = [".xlsx", ".xls"];
const DOCX_EXTENSIONS = [".docx"];
const TEXT_EXTENSIONS = [".txt", ".md", ".markdown"];

export async function uploadCasesFromFile(formData: FormData) {
  const { supabase, userId } = await requireSuperAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/staff/case-library?upload_error=" + encodeURIComponent("Choose a file to upload."));
  }
  const fallbackCompetencyId = String(formData.get("default_competency_id") || "");

  const name = (file as File).name.toLowerCase();
  const isExcel = EXCEL_EXTENSIONS.some((ext) => name.endsWith(ext));
  const isDocx = DOCX_EXTENSIONS.some((ext) => name.endsWith(ext));
  const isText = TEXT_EXTENSIONS.some((ext) => name.endsWith(ext));

  if (!isExcel && !isDocx && !isText) {
    redirect(
      "/staff/case-library?upload_error=" + encodeURIComponent("Unsupported file type. Use .xlsx, .docx, .txt, or .md.")
    );
  }

  const buffer = await (file as File).arrayBuffer();
  const aiEngine = String(formData.get("ai_engine") || "") as "" | "claude" | "fugu" | "kimi";

  let rawText: string | null = null;
  let parsed: { rows: ParsedCaseRow[]; errors: string[] };
  try {
    if (isExcel) {
      parsed = await parseExcelBuffer(buffer);
    } else if (isDocx) {
      const mammoth = await import("mammoth");
      const { value: text } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      rawText = text;
      parsed = parseStructuredText(text);
    } else {
      const text = Buffer.from(buffer).toString("utf-8");
      rawText = text;
      parsed = parseStructuredText(text);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read that file.";
    redirect("/staff/case-library?upload_error=" + encodeURIComponent(message));
  }

  const { data: competencies } = await supabase.from("competencies").select("id, code, name");
  const compList = (competencies || []) as { id: string; code: string; name: string }[];
  const byCode = new Map(compList.map((c) => [c.code.trim().toLowerCase(), c.id]));
  const byName = new Map(compList.map((c) => [c.name.trim().toLowerCase(), c.id]));

  let { rows, errors } = parsed;
  let usedAiFallback = false;

  // Structured "Key: value" parsing found nothing — if the uploader opted into
  // AI-assisted extraction and this is a text-based file, try again by asking
  // the configured engine to read the document freeform.
  if (rows.length === 0 && rawText && aiEngine) {
    try {
      const apiKey = await loadEngineKey(supabase, aiEngine);
      const { rows: aiRows, truncated } = await extractCasesWithAI(
        aiEngine,
        apiKey,
        rawText,
        compList.map((c) => ({ code: c.code, name: c.name }))
      );
      if (aiRows.length > 0) {
        rows = aiRows;
        errors = truncated ? ["Document was long — only the first ~14,000 characters were analyzed."] : [];
        usedAiFallback = true;
      } else {
        errors = [...errors, "AI-assisted extraction didn't find any usable cases in this document either."];
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "AI-assisted extraction failed.";
      errors = [...errors, message];
    }
  }

  const insertRows: Record<string, unknown>[] = [];
  const unresolvable: string[] = [];

  for (const row of rows) {
    let competencyId: string | undefined;
    if (row.competencyCode) competencyId = byCode.get(row.competencyCode.trim().toLowerCase());
    if (!competencyId && row.competencyName) competencyId = byName.get(row.competencyName.trim().toLowerCase());
    if (!competencyId && row.competencyCode) {
      // Excel "Competency" column sometimes holds a name rather than a code — try both maps.
      competencyId = byName.get(row.competencyCode.trim().toLowerCase());
    }
    if (!competencyId) competencyId = fallbackCompetencyId || undefined;

    if (!competencyId) {
      unresolvable.push(`${row.ref}: couldn't match a competency (got "${row.competencyCode || row.competencyName || "none"}") — skipped.`);
      continue;
    }

    insertRows.push({
      competency_id: competencyId,
      title: row.title,
      scenario_text: row.scenarioText,
      question_stem: row.questionStem,
      question_type: row.questionType,
      options: row.questionType === "mcq" ? row.options : null,
      difficulty: row.difficulty,
      methodology_tag: row.methodologyTag,
      methodology_notes: row.methodologyNotes,
      engine: usedAiFallback ? aiEngine : null,
      generated_by: userId,
    });
  }

  const allErrors = [...errors, ...unresolvable];

  let insertedCount = 0;
  if (insertRows.length > 0) {
    const { error } = await supabase.from("case_library").insert(insertRows);
    if (error) {
      redirect("/staff/case-library?upload_error=" + encodeURIComponent(`Insert failed: ${error.message}`));
    }
    insertedCount = insertRows.length;
  }

  revalidatePath("/staff/case-library");

  const params = new URLSearchParams({ uploaded: String(insertedCount), upload_errors: String(allErrors.length) });
  if (usedAiFallback) params.set("upload_ai", "1");
  if (allErrors.length > 0) params.set("upload_error_sample", allErrors.slice(0, 3).join(" | ").slice(0, 400));
  redirect(`/staff/case-library?${params.toString()}`);
}
