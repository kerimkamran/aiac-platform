"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateCaseLibraryEntries } from "@/lib/case-library";
import type { CompetencyForPrompt } from "@/lib/generation";

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
    .select("api_key, enabled")
    .eq("key", engineKey)
    .maybeSingle();
  if (!engine || !engine.enabled || !engine.api_key) {
    throw new Error(`That engine isn't configured. Add an API key and enable it in Settings first.`);
  }
  return engine.api_key as string;
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
