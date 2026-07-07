import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/authz";
import { Card, Icon, PageHeader } from "@/components/ui";
import { saveSettings } from "../actions";

type DataSettings = { retention_days: number; auto_anonymize: boolean };

export default async function AdminDataGovernancePage() {
  const settings = (await getSettings<DataSettings>("data_governance")) || { retention_days: 730, auto_anonymize: false };
  const supabase = await createClient();

  const [{ data: anonymized }, { data: held }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, anonymized_at").not("anonymized_at", "is", null).order("anonymized_at", { ascending: false }).limit(10),
    supabase.from("profiles").select("id, full_name, email").eq("legal_hold", true).limit(20),
  ]);

  const input = "w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent";
  const saveData = saveSettings.bind(null, "data_governance");

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <PageHeader
        title="Data Governance"
        subtitle="Retention, GDPR anonymization, and legal holds. Anonymization blanks personal data but keeps de-identified scores for statistics."
      />

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Card className="p-6">
          <form action={saveData} className="space-y-5">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <Icon name="layers" className="w-4 h-4 text-brand" />
              Retention policy
            </p>
            <div>
              <label className="block text-[12px] font-semibold text-muted mb-1.5" htmlFor="retention_days">Retain candidate data for (days)</label>
              <input id="retention_days" name="retention_days" type="number" min={30} defaultValue={settings.retention_days} className={input} />
              <p className="text-[11px] text-faint mt-1">
                Applies to candidate responses, recordings, and reports. A pg_cron job template in
                <code className="text-brand"> supabase/migrations/0004_admin.sql</code> enforces this automatically, always skipping legal holds.
              </p>
            </div>
            <label className="inline-flex items-center gap-2.5 text-sm font-medium cursor-pointer">
              <input type="checkbox" name="auto_anonymize" defaultChecked={settings.auto_anonymize} className="w-4 h-4 accent-[color:var(--brand)]" />
              Auto-anonymize (instead of delete) when retention expires
            </label>
            <button className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-light transition-colors">Save policy</button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm font-bold text-foreground mb-3">Legal holds ({(held || []).length})</p>
            {(held || []).length > 0 ? (
              <div className="space-y-2">
                {(held || []).map((h) => (
                  <Link key={h.id} href={`/admin/users/${h.id}`} className="flex items-center justify-between text-sm border border-line rounded-xl px-3.5 py-2.5 hover:border-accent transition-colors">
                    <span className="font-semibold text-foreground">{h.full_name}</span>
                    <span className="text-[11px] font-bold text-warning bg-amber-50 px-2 py-0.5 rounded-full ring-1 ring-inset ring-amber-200">HELD</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-faint">No users under legal hold. Set holds from a user&apos;s admin page.</p>
            )}
          </Card>

          <Card className="p-6">
            <p className="text-sm font-bold text-foreground mb-3">Recently anonymized (GDPR)</p>
            {(anonymized || []).length > 0 ? (
              <div className="space-y-2 text-sm">
                {(anonymized || []).map((a) => (
                  <p key={a.id} className="text-muted">
                    <span className="font-semibold text-foreground">{a.full_name}</span>
                    <span className="text-faint"> · {new Date(a.anonymized_at!).toLocaleString()}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-faint">No anonymizations yet. Trigger one from a user&apos;s admin page (Governance panel).</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
