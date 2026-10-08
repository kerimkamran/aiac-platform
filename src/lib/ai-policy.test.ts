import { describe, expect, it } from "vitest";
import { assertCanGenerate, AiPolicyError } from "./ai-policy";

// Minimal stand-in for the Supabase client: only the two calls the policy makes.
function fakeSupabase(setting: unknown, monthUsage: number) {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: setting === undefined ? null : { value: setting } }) }) }),
    }),
    rpc: async (fn: string) => (fn === "ai_runs_this_month" ? { data: monthUsage, error: null } : { data: null, error: null }),
  } as never;
}

describe("assertCanGenerate", () => {
  it("allows an allowed role within quota", async () => {
    const p = await assertCanGenerate(fakeSupabase({ scoring_enabled: true, allowed_roles: ["hr_admin"], monthly_quota: 10, model: "fugu" }, 3), "hr_admin", 2);
    expect(p.defaultEngine).toBe("fugu");
  });

  it("blocks when AI is switched off", async () => {
    await expect(assertCanGenerate(fakeSupabase({ scoring_enabled: false, allowed_roles: ["hr_admin"], monthly_quota: 10 }, 0), "hr_admin", 1)).rejects.toBeInstanceOf(AiPolicyError);
  });

  it("blocks a role that is not in the allowed list", async () => {
    await expect(assertCanGenerate(fakeSupabase({ scoring_enabled: true, allowed_roles: ["hr_admin"], monthly_quota: 10 }, 0), "recruiter", 1)).rejects.toThrow(/isn't allowed/);
  });

  it("blocks when the batch would exceed the monthly quota, and quota 0 blocks everything", async () => {
    await expect(assertCanGenerate(fakeSupabase({ scoring_enabled: true, allowed_roles: ["hr_admin"], monthly_quota: 5 }, 4), "hr_admin", 2)).rejects.toThrow(/quota/);
    await expect(assertCanGenerate(fakeSupabase({ scoring_enabled: true, allowed_roles: ["hr_admin"], monthly_quota: 0 }, 0), "hr_admin", 1)).rejects.toThrow(/quota/);
  });
});
