import { createClient } from "@/lib/supabase/server";
import { loadAiPolicy } from "@/lib/ai-policy";
import type { EngineKey } from "@/lib/ai-engine";
import { PageHeader } from "@/components/ui";
import { NewAssessmentForm, type CatalogCompetency, type CatalogEngine, type CatalogPosition } from "./NewAssessmentForm";

export const maxDuration = 300;

export default async function NewAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ position?: string }>;
}) {
  const { position: preselect } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id || "").maybeSingle();
  const role = profile?.role ?? "";

  const [policy, { data: used }, { data: competencies }, { data: engines }, { data: positions }, { data: files }] = await Promise.all([
    loadAiPolicy(supabase),
    supabase.rpc("ai_runs_this_month"),
    supabase.from("competencies").select("id, code, name, category, description").order("category").order("name"),
    supabase.rpc("engine_policy_for_staff"),
    supabase
      .from("positions")
      .select("id, title, department, default_level, updated_at")
      .is("archived_at", null)
      .order("title"),
    supabase.from("position_files").select("position_id"),
  ]);

  const fileCounts = new Map<string, number>();
  for (const f of files || []) fileCounts.set(f.position_id, (fileCounts.get(f.position_id) || 0) + 1);

  const usedCount = typeof used === "number" ? used : 0;
  const roleAllowed = policy.allowedRoles.includes(role);
  const canUseAi = policy.enabled && roleAllowed && usedCount < policy.monthlyQuota;

  const catalogPositions: CatalogPosition[] = (positions || []).map((p) => ({
    id: p.id,
    title: p.title,
    department: p.department,
    defaultLevel: p.default_level,
    fileCount: fileCounts.get(p.id) || 0,
  }));

  const catalogEngines: CatalogEngine[] = ((engines || []) as { key: EngineKey; display_name: string; enabled: boolean; configured: boolean; allow_context: boolean }[]).map((e) => ({
    key: e.key,
    displayName: e.display_name,
    enabled: e.enabled,
    configured: e.configured,
    allowContext: e.allow_context,
  }));

  const catalogCompetencies: CatalogCompetency[] = (competencies || []).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    category: c.category,
    description: c.description,
  }));

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <PageHeader
        title="New assessment"
        subtitle="Choose who it is for. Add context if you have it. Generate one draft per position and level, then review each draft before publishing."
      />
      <NewAssessmentForm
        positions={catalogPositions}
        competencies={catalogCompetencies}
        engines={catalogEngines}
        defaultEngine={policy.defaultEngine}
        canUseAi={canUseAi}
        aiDisabledReason={
          !policy.enabled
            ? "AI generation is switched off in AI Governance."
            : !roleAllowed
              ? "Your role isn't allowed to generate AI drafts. You can still create empty drafts and ask an HR admin for generated ones."
              : usedCount >= policy.monthlyQuota
                ? "The monthly AI quota is used up. You can still create empty drafts."
                : null
        }
        quota={{ used: usedCount, total: policy.monthlyQuota }}
        preselectPositionId={preselect || null}
      />
    </div>
  );
}
