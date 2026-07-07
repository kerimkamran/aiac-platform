import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/authz";
import { Card, Icon, PageHeader } from "@/components/ui";
import { saveSettings } from "../actions";

type SecuritySettings = { session_timeout_minutes: number; ip_allowlist: string[]; mfa_required_roles: string[] };

export default async function AdminSecurityPage() {
  const settings = (await getSettings<SecuritySettings>("security")) || {
    session_timeout_minutes: 480,
    ip_allowlist: [],
    mfa_required_roles: [],
  };
  const supabase = await createClient();
  const { count: staffCount } = await supabase.from("profiles").select("id", { count: "exact", head: true }).neq("role", "candidate");

  const input = "w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent";
  const saveSecurity = saveSettings.bind(null, "security");

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <PageHeader
        title="Security"
        subtitle="Session policy, network restrictions, and MFA enforcement for the platform's staff and admin surface."
      />

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Card className="p-6">
          <form action={saveSecurity} className="space-y-5">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <Icon name="ban" className="w-4 h-4 text-brand" />
              Access policy
            </p>
            <div>
              <label className="block text-[12px] font-semibold text-muted mb-1.5" htmlFor="session_timeout_minutes">Session timeout (minutes)</label>
              <input id="session_timeout_minutes" name="session_timeout_minutes" type="number" min={15} defaultValue={settings.session_timeout_minutes} className={input} />
              <p className="text-[11px] text-faint mt-1">Idle sessions beyond this are signed out on their next request.</p>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-muted mb-1.5" htmlFor="ip_allowlist">IP allowlist for staff/admin (one per line, empty = no restriction)</label>
              <textarea id="ip_allowlist" name="ip_allowlist" rows={3} defaultValue={settings.ip_allowlist.join("\n")} className={input} placeholder="203.0.113.0&#10;198.51.100.14" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-muted mb-2">Require MFA for roles</p>
              <div className="flex flex-wrap gap-3">
                {["system_admin", "org_admin", "hr_admin", "recruiter"].map((r) => (
                  <label key={r} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="mfa_required_roles" value={r} defaultChecked={settings.mfa_required_roles.includes(r)} className="w-4 h-4 accent-[color:var(--brand)]" />
                    {r.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </div>
            <button className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-light transition-colors">Save security settings</button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm font-bold text-foreground mb-3">What the platform enforces</p>
            <ul className="space-y-2.5 text-[13px] text-muted">
              {[
                "Authorization on every server action and API route via the central RBAC layer (has_perm in Postgres).",
                "Row-Level Security on every table; candidates see only their own rows.",
                "Append-only audit log — UPDATE/DELETE revoked at the database level.",
                "PII access logging: opening a person's admin profile writes an audit event.",
                "Security headers (CSP, HSTS, X-Frame-Options DENY, nosniff) on every response.",
                `Session cookies are HttpOnly and managed by Supabase Auth for ${staffCount ?? "all"} staff accounts.`,
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <Icon name="check" className="w-4 h-4 text-good shrink-0 mt-0.5" />
                  {t}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-bold text-foreground mb-3">Configured in Supabase (dashboard-level)</p>
            <ul className="space-y-2.5 text-[13px] text-muted">
              <li><span className="font-semibold text-foreground">MFA (TOTP):</span> users enroll under Account → Security; enforcement above blocks non-enrolled admins at login.</li>
              <li><span className="font-semibold text-foreground">SSO (SAML / OIDC):</span> available on the Supabase Pro plan — Dashboard → Authentication → SSO. The app is provider-agnostic once enabled.</li>
              <li><span className="font-semibold text-foreground">Password policy:</span> minimum length & leaked-password protection — Dashboard → Authentication → Policies.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
