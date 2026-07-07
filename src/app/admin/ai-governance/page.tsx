import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/authz";
import { Avatar, Card, Icon, PageHeader } from "@/components/ui";
import { saveSettings } from "../actions";

type AiSettings = { scoring_enabled: boolean; allowed_roles: string[]; monthly_quota: number; model: string };

export default async function AdminAiGovernancePage() {
  const settings = (await getSettings<AiSettings>("ai")) || {
    scoring_enabled: true,
    allowed_roles: ["hr_admin", "org_admin", "system_admin"],
    monthly_quota: 1000,
    model: "claude",
  };
  const supabase = await createClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ data: engines }, { count: monthUsage }, { data: aiAudit }] = await Promise.all([
    supabase.from("generation_engines").select("key, display_name, enabled"),
    supabase.from("admin_audit_log").select("id", { count: "exact", head: true }).eq("module", "ai").gte("created_at", monthStart.toISOString()),
    supabase
      .from("admin_audit_log")
      .select("id, action, details, created_at, actor:profiles!admin_audit_log_actor_id_fkey(full_name)")
      .eq("module", "ai")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const input = "w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent";
  const saveAi = saveSettings.bind(null, "ai");

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <PageHeader
        title="AI Governance"
        subtitle="Who may use AI features, which model runs, how much it may be used — and an audit trail of every AI action."
      />

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Card className="p-6">
          <form action={saveAi} className="space-y-5">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <Icon name="brain" className="w-4 h-4 text-brand" />
              AI feature policy
            </p>
            <label className="inline-flex items-center gap-2.5 text-sm font-medium cursor-pointer">
              <input type="checkbox" name="scoring_enabled" defaultChecked={settings.scoring_enabled} className="w-4 h-4 accent-[color:var(--brand)]" />
              AI features enabled (scoring assistance & assessment generation)
            </label>
            <div>
              <p className="text-[12px] font-semibold text-muted mb-2">Roles allowed to trigger AI generation</p>
              <div className="flex flex-wrap gap-3">
                {["system_admin", "org_admin", "hr_admin", "recruiter"].map((r) => (
                  <label key={r} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="allowed_roles" value={r} defaultChecked={settings.allowed_roles.includes(r)} className="w-4 h-4 accent-[color:var(--brand)]" />
                    {r.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-muted mb-1.5" htmlFor="model">Default model</label>
                <select id="model" name="model" defaultValue={settings.model} className={input}>
                  {(engines || []).map((e) => (
                    <option key={e.key} value={e.key}>{e.display_name}{e.enabled ? "" : " (disabled)"}</option>
                  ))}
                  {(!engines || engines.length === 0) && <option value="claude">Claude</option>}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-muted mb-1.5" htmlFor="monthly_quota">Monthly AI action quota</label>
                <input id="monthly_quota" name="monthly_quota" type="number" min={0} defaultValue={settings.monthly_quota} className={input} />
              </div>
            </div>
            <button className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-light transition-colors">Save AI policy</button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm font-bold text-foreground mb-1">Usage this month</p>
            <p className="text-[32px] font-bold text-brand tabular-nums">
              {monthUsage ?? 0}
              <span className="text-sm font-semibold text-faint"> / {settings.monthly_quota} actions</span>
            </p>
            <div className="h-2 rounded-full bg-line/70 overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.min(100, ((monthUsage ?? 0) / Math.max(1, settings.monthly_quota)) * 100)}%` }}
              />
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-bold text-foreground mb-4">AI audit trail</p>
            <div className="space-y-2.5">
              {(aiAudit || []).map((e) => {
                const actor = e.actor as unknown as { full_name: string } | null;
                return (
                  <div key={e.id} className="flex items-center gap-2.5 text-[12.5px]">
                    <Avatar name={actor?.full_name || "?"} className="w-6 h-6 text-[9px]" />
                    <span className="font-medium text-foreground">{actor?.full_name || "System"}</span>
                    <span className="text-muted">{e.action.replace(/_/g, " ")}</span>
                    <span className="text-faint ml-auto whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                );
              })}
              {(!aiAudit || aiAudit.length === 0) && (
                <p className="text-xs text-faint">No AI actions recorded yet — generation and scoring events will appear here.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
