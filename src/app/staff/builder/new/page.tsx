import { createClient } from "@/lib/supabase/server";
import { loadAiPolicy } from "@/lib/ai-policy";
import type { EngineKey } from "@/lib/ai-engine";
import { PageHeader } from "@/components/ui";
import { NewAssessmentForm, type CatalogCompetency, type CatalogEngine } from "./NewAssessmentForm";

export const maxDuration = 300;

export default async function NewAssessmentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id || "").maybeSingle();
  const role = profile?.role ?? "";

  const [policy, { data: used }, { data: competencies }, { data: engines }] = await Promise.all([
    loadAiPolicy(supabase),
    supabase.rpc("ai_runs_this_month"),
    supabase.from("competencies").select("id, code, name, category, description").order("category").order("name"),
    supabase.rpc("engine_policy_for_staff"),
  ]);

  const usedCount = typeof used === "number" ? used : 0;
  const roleAllowed = policy.allowedRoles.includes(role);
  const canUseAi = policy.enabled && roleAllowed && usedCount < policy.monthlyQuota;

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
        subtitle="Choose the job title and level. Add context if you have it. Generate one draft per level, then review each draft before publishing."
      />
      <NewAssessmentForm
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
      />
    </div>
  );
}
