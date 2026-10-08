import type { EngineKey } from "@/lib/ai-engine";

// One place that decides whether an AI generation may run, based on the AI
// Governance settings (app_settings key 'ai') that admins edit at /admin/ai-governance.
// Before this module existed, generation hard-coded hr_admin/system_admin and
// ignored the switch, the allowed roles, the default model and the quota.

export type AiPolicy = {
  enabled: boolean;
  allowedRoles: string[];
  monthlyQuota: number;
  defaultEngine: EngineKey;
};

type SupabaseLike = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

const ENGINES: EngineKey[] = ["claude", "fugu", "kimi"];

export const DEFAULT_AI_POLICY: AiPolicy = {
  enabled: true,
  allowedRoles: ["hr_admin", "org_admin", "system_admin"],
  monthlyQuota: 1000,
  defaultEngine: "claude",
};

export async function loadAiPolicy(supabase: SupabaseLike): Promise<AiPolicy> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "ai").maybeSingle();
  const raw = (data?.value || {}) as {
    scoring_enabled?: unknown;
    allowed_roles?: unknown;
    monthly_quota?: unknown;
    model?: unknown;
  };
  return {
    enabled: typeof raw.scoring_enabled === "boolean" ? raw.scoring_enabled : DEFAULT_AI_POLICY.enabled,
    allowedRoles: Array.isArray(raw.allowed_roles)
      ? raw.allowed_roles.filter((r): r is string => typeof r === "string")
      : DEFAULT_AI_POLICY.allowedRoles,
    monthlyQuota:
      typeof raw.monthly_quota === "number" && Number.isFinite(raw.monthly_quota) ? Math.max(0, raw.monthly_quota) : DEFAULT_AI_POLICY.monthlyQuota,
    defaultEngine: ENGINES.includes(raw.model as EngineKey) ? (raw.model as EngineKey) : DEFAULT_AI_POLICY.defaultEngine,
  };
}

export class AiPolicyError extends Error {}

// Throws AiPolicyError with a message staff can read. `runs` is how many AI
// generation runs the batch needs (one per draft).
export async function assertCanGenerate(
  supabase: SupabaseLike,
  role: string,
  runs: number
): Promise<AiPolicy> {
  const policy = await loadAiPolicy(supabase);

  if (!policy.enabled) {
    throw new AiPolicyError("AI generation is switched off in AI Governance. Ask a system admin to turn it on.");
  }
  if (!policy.allowedRoles.includes(role)) {
    throw new AiPolicyError("Your role isn't allowed to generate AI drafts. You can still create an empty draft.");
  }

  const { data: used, error } = await supabase.rpc("ai_runs_this_month");
  if (error) throw new AiPolicyError("Couldn't check the monthly AI quota. Try again in a moment.");
  const usedCount = typeof used === "number" ? used : 0;
  if (usedCount + runs > policy.monthlyQuota) {
    throw new AiPolicyError(
      `This would go over the monthly AI quota (${usedCount} of ${policy.monthlyQuota} used). Ask a system admin to raise it.`
    );
  }
  return policy;
}
