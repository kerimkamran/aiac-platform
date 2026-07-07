import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/authz";
import { Avatar, Card, Icon, PageHeader, StatusBadge } from "@/components/ui";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import {
  updateUserProfile,
  setUserStatus,
  toggleUserFlag,
  anonymizeUser,
  addPermissionOverride,
  removePermissionOverride,
} from "../../actions";

const TOASTS: ToastSpec[] = [
  { param: "ok", variant: "success" },
  { param: "error", variant: "error" },
];

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: user }, { data: managers }, { data: units }, { data: perms }, { data: overrides }, { data: audit }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("profiles").select("id, full_name").neq("role", "candidate").eq("status", "active").order("full_name"),
      supabase.from("org_units").select("id, name, unit_type").order("name"),
      supabase.from("permissions").select("id, module, action").order("module").order("action"),
      supabase
        .from("user_permission_overrides")
        .select("id, granted, expires_at, permissions(module, action)")
        .eq("user_id", id),
      supabase
        .from("admin_audit_log")
        .select("id, module, action, result, created_at, actor:profiles!admin_audit_log_actor_id_fkey(full_name)")
        .or(`target_id.eq.${id},target_user_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  if (!user) notFound();

  // PII access is itself an audited event
  await logAudit({ module: "pii_access", action: "profile_viewed", targetType: "user", targetId: id });

  const updateWithId = updateUserProfile.bind(null, id);
  const customFieldsText = Object.entries((user.custom_fields as Record<string, string>) || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const input = "w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent";
  const label = "block text-[12px] font-semibold text-muted mb-1.5";

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-5 font-medium">
        <Icon name="arrowLeft" className="w-4 h-4" />
        All users
      </Link>

      <PageHeader title={user.full_name || user.email} subtitle={user.email}>
        <StatusBadge status={user.status} />
        {user.status !== "active" && (
          <form action={setUserStatus.bind(null, id, "active")}>
            <ConfirmSubmitButton
              confirmMessage={`Restore ${user.full_name}'s access? They will be able to sign in again.`}
              tone="accent"
              className="bg-accent text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-accent-dark transition-colors"
            >
              Restore
            </ConfirmSubmitButton>
          </form>
        )}
        {user.status === "active" && (
          <>
            <form action={setUserStatus.bind(null, id, "suspended")}>
              <ConfirmSubmitButton
                confirmMessage={`Suspend ${user.full_name}? They will be temporarily blocked from logging in.`}
                tone="critical"
                className="border border-line text-sm font-semibold px-4 py-2.5 rounded-xl hover:border-warning transition-colors"
              >
                Suspend
              </ConfirmSubmitButton>
            </form>
            <form action={setUserStatus.bind(null, id, "deactivated")}>
              <ConfirmSubmitButton
                confirmMessage={`Deactivate ${user.full_name}? They will be signed out and blocked from logging in.`}
                className="border border-line text-critical text-sm font-semibold px-4 py-2.5 rounded-xl hover:border-critical hover:bg-red-50 transition-colors"
              >
                Deactivate
              </ConfirmSubmitButton>
            </form>
          </>
        )}
      </PageHeader>

      <ToastFromParams specs={TOASTS} />

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        <div className="space-y-6">
          {/* Profile */}
          <Card className="p-6">
            <p className="text-sm font-bold text-foreground mb-5 flex items-center gap-2">
              <Avatar name={user.full_name || "?"} className="w-7 h-7 text-[10px]" />
              Profile
            </p>
            <form action={updateWithId} className="grid sm:grid-cols-2 gap-4">
              <div><label className={label} htmlFor="full_name">Full name</label><input id="full_name" name="full_name" defaultValue={user.full_name || ""} required className={input} /></div>
              <div><label className={label} htmlFor="phone">Phone</label><input id="phone" name="phone" defaultValue={user.phone || ""} className={input} /></div>
              <div><label className={label} htmlFor="job_title">Job title</label><input id="job_title" name="job_title" defaultValue={user.job_title || ""} className={input} /></div>
              <div><label className={label} htmlFor="department">Department</label><input id="department" name="department" defaultValue={user.department || ""} className={input} /></div>
              <div><label className={label} htmlFor="business_unit">Business unit</label><input id="business_unit" name="business_unit" defaultValue={user.business_unit || ""} className={input} /></div>
              <div><label className={label} htmlFor="location">Location</label><input id="location" name="location" defaultValue={user.location || ""} className={input} /></div>
              <div>
                <label className={label} htmlFor="manager_id">Manager</label>
                <select id="manager_id" name="manager_id" defaultValue={user.manager_id || ""} className={input}>
                  <option value="">— none —</option>
                  {(managers || []).filter((m) => m.id !== id).map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="org_unit_id">Org unit</label>
                <select id="org_unit_id" name="org_unit_id" defaultValue={user.org_unit_id || ""} className={input}>
                  <option value="">— none —</option>
                  {(units || []).map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.unit_type.replace(/_/g, " ")})</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 border-t border-line pt-4 grid sm:grid-cols-3 gap-4">
                <label className="inline-flex items-center gap-2.5 text-sm font-medium cursor-pointer">
                  <input type="checkbox" name="is_employee" defaultChecked={user.is_employee} className="w-4 h-4 accent-[color:var(--brand)]" />
                  Internal employee
                </label>
                <div><label className={label} htmlFor="employee_id">Employee ID</label><input id="employee_id" name="employee_id" defaultValue={user.employee_id || ""} className={input} /></div>
                <div><label className={label} htmlFor="hire_date">Hire date</label><input id="hire_date" name="hire_date" type="date" defaultValue={user.hire_date || ""} className={input} /></div>
              </div>

              <div className="sm:col-span-2 border-t border-line pt-4 grid sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2"><label className={label} htmlFor="expertise">Assessor expertise (comma-separated)</label><input id="expertise" name="expertise" defaultValue={(user.expertise || []).join(", ")} className={input} /></div>
                <div>
                  <label className={label} htmlFor="availability">Availability</label>
                  <select id="availability" name="availability" defaultValue={user.availability || "available"} className={input}>
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>
                <div><label className={label} htmlFor="max_workload">Max open reviews</label><input id="max_workload" name="max_workload" type="number" min={0} defaultValue={user.max_workload ?? 5} className={input} /></div>
              </div>

              <div className="sm:col-span-2">
                <label className={label} htmlFor="custom_fields">Custom fields (one per line, key: value)</label>
                <textarea id="custom_fields" name="custom_fields" rows={3} defaultValue={customFieldsText} className={input} placeholder="badge_color: green" />
              </div>

              <div className="sm:col-span-2">
                <button className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-light transition-colors">Save profile</button>
              </div>
            </form>
          </Card>

          {/* Permission overrides */}
          <Card className="p-6">
            <p className="text-sm font-bold text-foreground mb-1">Temporary permission overrides</p>
            <p className="text-xs text-muted mb-4">Grant or deny a single permission beyond the role matrix, with optional expiry.</p>
            <div className="space-y-2 mb-4">
              {(overrides || []).map((o) => {
                const p = o.permissions as unknown as { module: string; action: string } | null;
                return (
                  <div key={o.id} className="flex items-center gap-3 text-[13px] border border-line rounded-xl px-3.5 py-2.5">
                    <span className={`font-bold ${o.granted ? "text-good" : "text-critical"}`}>{o.granted ? "GRANT" : "DENY"}</span>
                    <span className="text-foreground font-medium">{p?.module}.{p?.action}</span>
                    <span className="text-faint ml-auto">{o.expires_at ? `until ${new Date(o.expires_at).toLocaleDateString()}` : "no expiry"}</span>
                    <form action={removePermissionOverride.bind(null, id, o.id)}>
                      <button aria-label="Remove override" className="text-faint hover:text-critical"><Icon name="trash" className="w-4 h-4" /></button>
                    </form>
                  </div>
                );
              })}
              {(!overrides || overrides.length === 0) && <p className="text-xs text-faint">No overrides.</p>}
            </div>
            <form action={addPermissionOverride.bind(null, id)} className="flex flex-wrap items-end gap-2.5">
              <select name="permission_id" required className="bg-surface border border-line rounded-xl px-3 py-2.5 text-sm flex-1 min-w-44" aria-label="Permission">
                {(perms || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.module}.{p.action}</option>
                ))}
              </select>
              <select name="granted" className="bg-surface border border-line rounded-xl px-3 py-2.5 text-sm" aria-label="Grant or deny">
                <option value="grant">Grant</option>
                <option value="deny">Deny</option>
              </select>
              <input name="expires_at" type="date" className="bg-surface border border-line rounded-xl px-3 py-2 text-sm" aria-label="Expires" />
              <button className="bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-light transition-colors">Add</button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Governance flags */}
          <Card className="p-6 space-y-4">
            <p className="text-sm font-bold text-foreground">Governance</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Blacklisted</span>
              <form action={toggleUserFlag.bind(null, id, "blacklisted", !user.blacklisted)}>
                <button className={`text-[12px] font-bold px-3 py-1.5 rounded-full ring-1 ring-inset ${user.blacklisted ? "bg-red-50 text-critical ring-red-200" : "bg-surface text-muted ring-line"}`}>
                  {user.blacklisted ? "Yes — clear" : "No — set"}
                </button>
              </form>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Legal hold</span>
              <form action={toggleUserFlag.bind(null, id, "legal_hold", !user.legal_hold)}>
                <button className={`text-[12px] font-bold px-3 py-1.5 rounded-full ring-1 ring-inset ${user.legal_hold ? "bg-amber-50 text-warning ring-amber-200" : "bg-surface text-muted ring-line"}`}>
                  {user.legal_hold ? "Held — release" : "Off — hold"}
                </button>
              </form>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Consent given</span>
              <span className="text-foreground font-medium">{user.consent_at ? new Date(user.consent_at).toLocaleDateString() : "—"}</span>
            </div>
            <div className="border-t border-line pt-4">
              <form action={anonymizeUser.bind(null, id)}>
                <ConfirmSubmitButton
                  confirmMessage={`GDPR-anonymize ${user.full_name}? Personal data is permanently blanked (scores are kept, de-identified). This cannot be undone.`}
                  className="w-full border border-line text-critical text-sm font-semibold px-4 py-2.5 rounded-xl hover:border-critical hover:bg-red-50 transition-colors"
                >
                  Anonymize (GDPR)
                </ConfirmSubmitButton>
              </form>
              {user.anonymized_at && <p className="text-[11px] text-faint mt-2">Anonymized {new Date(user.anonymized_at).toLocaleString()}</p>}
            </div>
          </Card>

          {/* Per-user audit trail */}
          <Card className="p-6">
            <p className="text-sm font-bold text-foreground mb-4">Recent activity on this user</p>
            <div className="space-y-2.5">
              {(audit || []).map((e) => {
                const actor = e.actor as unknown as { full_name: string } | null;
                return (
                  <p key={e.id} className="text-[12.5px] text-muted">
                    <span className="font-semibold text-foreground">{actor?.full_name || "System"}</span> — {e.action.replace(/_/g, " ")}
                    <span className="text-faint"> · {new Date(e.created_at).toLocaleString()}</span>
                  </p>
                );
              })}
              {(!audit || audit.length === 0) && <p className="text-xs text-faint">No recorded events.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
