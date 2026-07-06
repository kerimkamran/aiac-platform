import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card, Icon, Avatar, StatusBadge } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SelectAllCheckbox } from "@/components/SelectAllCheckbox";
import {
  addCandidate,
  addDecisionMaker,
  addStaffMember,
  resendInvite,
  bulkAddCandidates,
  updateUserRole,
  setUserStatus,
  bulkPeopleAction,
} from "./actions";

const ROLE_LABEL: Record<string, string> = {
  system_admin: "Super Admin",
  hr_admin: "Admin",
  recruiter: "Recruiter",
  hiring_manager: "Hiring Manager",
  decision_maker: "Decision Maker",
  candidate: "Candidate",
};

const STAFF_ROLE_OPTIONS = ["recruiter", "hiring_manager", "hr_admin", "system_admin"] as const;
const ALL_ROLE_OPTIONS = ["candidate", "decision_maker", ...STAFF_ROLE_OPTIONS] as const;

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string | null;
  status: string;
  created_at: string;
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; added?: string; q?: string; role?: string; status?: string; edit?: string }>;
}) {
  const { error, added, q = "", role: roleFilter = "", status: statusFilter = "", edit } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ownProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ownProfile || (ownProfile.role !== "hr_admin" && ownProfile.role !== "system_admin")) {
    redirect("/staff?error=" + encodeURIComponent("Only HR admins and the super admin can manage people."));
  }
  const isSuperAdmin = ownProfile.role === "system_admin";
  const grantableStaffRoles = isSuperAdmin ? STAFF_ROLE_OPTIONS : (["recruiter", "hiring_manager"] as const);
  const grantableAllRoles = isSuperAdmin ? ALL_ROLE_OPTIONS : (["candidate", "decision_maker", "recruiter", "hiring_manager"] as const);

  const [{ data: profiles }, { data: auditRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, department, status, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("admin_audit_log")
      .select(
        "id, action, details, created_at, actor:profiles!admin_audit_log_actor_id_fkey(full_name), target:profiles!admin_audit_log_target_user_id_fkey(full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const allRows = (profiles || []) as unknown as ProfileRow[];
  const editingUser = edit ? allRows.find((p) => p.id === edit) : undefined;

  const matchesSearch = (p: ProfileRow) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return p.full_name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle);
  };
  const matchesStatus = (p: ProfileRow) => !statusFilter || p.status === statusFilter;
  const matchesRole = (p: ProfileRow) => !roleFilter || p.role === roleFilter;

  const staffRows = allRows.filter((p) => p.role !== "candidate" && matchesSearch(p) && matchesStatus(p) && matchesRole(p));
  const candidateRows = allRows.filter((p) => p.role === "candidate" && matchesSearch(p) && matchesStatus(p));

  const qs = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ q, role: roleFilter, status: statusFilter, ...overrides });
    for (const [k, v] of Array.from(params.entries())) if (!v) params.delete(k);
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  type AuditRow = {
    id: string;
    action: string;
    details: Record<string, unknown> | null;
    created_at: string;
    actor: { full_name: string } | null;
    target: { full_name: string } | null;
  };
  const audit = (auditRows || []) as unknown as AuditRow[];

  const AUDIT_LABEL: Record<string, string> = {
    user_invited: "invited",
    role_updated: "updated the role of",
    user_deactivated: "deactivated",
    user_reactivated: "reactivated",
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader
        title="People & Access"
        subtitle="Manage every account — candidates, staff, and decision makers — with role changes, deactivation, and a full activity log. Accounts are invite-only."
      />

      {error && (
        <div className="mb-6 text-sm text-critical bg-red-50 border border-red-200 rounded-xl px-4 py-3">{decodeURIComponent(error)}</div>
      )}
      {added && (
        <div className="mb-6 text-sm text-accent-dark bg-accent-soft border border-accent/20 rounded-xl px-4 py-3">
          {decodeURIComponent(added)}
        </div>
      )}

      {editingUser && (
        <Card className="p-6 mb-8 border-brand/20">
          <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
            <Icon name="wand" className="w-4 h-4 text-brand" />
            Edit {editingUser.full_name}
          </p>
          <p className="text-xs text-muted mb-4">{editingUser.email}</p>
          <form action={updateUserRole} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <input type="hidden" name="user_id" value={editingUser.id} />
            <div>
              <label className="text-[11px] font-semibold text-muted block mb-1">Role</label>
              <select
                name="role"
                defaultValue={editingUser.role}
                className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {grantableAllRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
                {!(grantableAllRoles as readonly string[]).includes(editingUser.role) && (
                  <option value={editingUser.role}>{ROLE_LABEL[editingUser.role] || editingUser.role} (current)</option>
                )}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted block mb-1">Department / structure</label>
              <input
                name="department"
                defaultValue={editingUser.department || ""}
                placeholder="Optional"
                className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex gap-2">
              <button className="bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-light transition-colors">
                Save
              </button>
              <Link
                href="/staff/people"
                className="inline-flex items-center border border-line text-sm font-semibold px-4 py-2.5 rounded-xl text-foreground hover:border-brand transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
          {!isSuperAdmin && (
            <p className="text-[11px] text-faint mt-3">
              Only the super admin can grant Admin or Super Admin. You can grant Recruiter or Hiring Manager.
            </p>
          )}
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <Card className="p-6">
          <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
            <Icon name="users" className="w-4 h-4 text-brand" />
            Add a candidate
          </p>
          <p className="text-xs text-muted mb-4">Creates the account and emails an invite link to set a password.</p>
          <form action={addCandidate} className="space-y-3">
            <input name="full_name" required placeholder="Full name" className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            <input name="email" type="email" required placeholder="Email address" className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            <input name="department" placeholder="Department / structure (optional)" className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            <button className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-light transition-colors">
              <Icon name="plus" className="w-4 h-4" />
              Add & invite candidate
            </button>
          </form>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
            <Icon name="shield" className="w-4 h-4 text-brand" />
            Add a decision maker
          </p>
          <p className="text-xs text-muted mb-4">
            External or internal stakeholders who can review specific candidates and submit a decision. Assign them to
            a candidate from that candidate&apos;s review page.
          </p>
          <form action={addDecisionMaker} className="space-y-3">
            <input name="full_name" required placeholder="Full name" className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            <input name="email" type="email" required placeholder="Email address" className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            <button className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-light transition-colors">
              <Icon name="plus" className="w-4 h-4" />
              Add & invite decision maker
            </button>
          </form>
        </Card>
      </div>

      <Card className="p-6 mb-5">
        <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
          <Icon name="building" className="w-4 h-4 text-brand" />
          Add a staff member
        </p>
        <p className="text-xs text-muted mb-4">
          Recruiter, Hiring Manager, Admin, or Super Admin.{" "}
          {!isSuperAdmin && "Only the super admin can grant Admin or Super Admin."}
        </p>
        <form action={addStaffMember} className="grid sm:grid-cols-2 gap-3">
          <input name="full_name" required placeholder="Full name" className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          <input name="email" type="email" required placeholder="Email address" className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          <select name="role" required className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
            {grantableStaffRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <input name="department" placeholder="Department / structure (optional)" className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          <button className="sm:col-span-2 inline-flex items-center justify-center gap-2 bg-brand text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-light transition-colors">
            <Icon name="plus" className="w-4 h-4" />
            Add & invite staff member
          </button>
        </form>
      </Card>

      <Card className="p-6 mb-8">
        <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
          <Icon name="users" className="w-4 h-4 text-brand" />
          Bulk add candidates (CSV)
        </p>
        <p className="text-xs text-muted mb-4">
          Upload a CSV with columns <code className="bg-surface px-1 rounded">full_name</code>,{" "}
          <code className="bg-surface px-1 rounded">email</code>, and optional{" "}
          <code className="bg-surface px-1 rounded">department</code>. Each row is created and invited by email, just
          like adding one candidate at a time.{" "}
          <a
            href="data:text/csv;charset=utf-8,full_name%2Cemail%2Cdepartment%0AJane%20Doe%2Cjane%40example.com%2COperations"
            download="candidate-upload-template.csv"
            className="text-brand font-semibold hover:underline"
          >
            Download template
          </a>
        </p>
        <form action={bulkAddCandidates} className="flex items-center gap-3">
          <input
            name="csv"
            type="file"
            accept=".csv,text/csv"
            required
            className="text-sm text-muted file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:bg-brand file:text-white file:text-sm file:font-semibold file:cursor-pointer"
          />
          <button className="inline-flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-light transition-colors shrink-0">
            <Icon name="download" className="w-4 h-4 rotate-180" />
            Upload & invite all
          </button>
        </form>
      </Card>

      {/* Search & filter */}
      <form action="/staff/people" className="flex flex-wrap items-center gap-2.5 mb-4">
        <Icon name="search" className="w-4 h-4 text-faint" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name or email…"
          className="flex-1 min-w-48 max-w-xs bg-surface border border-line rounded-xl px-3.5 py-2 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <select name="role" defaultValue={roleFilter} className="bg-surface border border-line rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">All roles</option>
          {STAFF_ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
          <option value="decision_maker">Decision Maker</option>
        </select>
        <select name="status" defaultValue={statusFilter} className="bg-surface border border-line rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
        </select>
        <button className="bg-brand text-white text-xs font-semibold px-3.5 py-2 rounded-xl hover:bg-brand-light transition-colors">
          Apply
        </button>
        {(q || roleFilter || statusFilter) && (
          <Link href="/staff/people" className="text-xs font-semibold text-muted hover:text-foreground">
            Clear
          </Link>
        )}
      </form>

      <Card className="p-0 overflow-hidden mb-8">
        <p className="text-sm font-bold text-foreground px-6 pt-5 pb-3">Team & decision makers ({staffRows.length})</p>
        <form
          id="bulk-staff-form"
          action={bulkPeopleAction}
          className="flex flex-wrap items-center gap-2.5 px-6 py-3 border-y border-line bg-surface/60"
        >
          <span className="text-xs font-semibold text-muted">Bulk action:</span>
          <select
            name="bulk_action"
            className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="set_role">Change role to…</option>
            <option value="activate">Activate</option>
            <option value="deactivate">Deactivate</option>
            <option value="resend_invite">Resend invite</option>
          </select>
          <select
            name="bulk_role"
            className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {grantableAllRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <ConfirmSubmitButton
            confirmMessage="Apply this bulk action to everyone selected below?"
            className="bg-brand text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg hover:bg-brand-light transition-colors"
          >
            Apply to selected
          </ConfirmSubmitButton>
          <span className="text-[11px] text-faint">Select people in the table below, then apply.</span>
        </form>
        <table className="w-full text-sm">
          <thead className="text-faint text-[11px] uppercase tracking-wider border-y border-line">
            <tr>
              <th className="px-6 py-3 w-8">
                <SelectAllCheckbox formId="bulk-staff-form" name="user_ids" />
              </th>
              <th className="text-left px-6 py-3 font-semibold">Name</th>
              <th className="text-left px-6 py-3 font-semibold">Role</th>
              <th className="text-left px-6 py-3 font-semibold">Department</th>
              <th className="text-left px-6 py-3 font-semibold">Status</th>
              <th className="text-left px-6 py-3 font-semibold">Added</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {staffRows.map((p) => {
              const isSelf = p.id === user.id;
              return (
                <tr key={p.id}>
                  <td className="px-6 py-3">
                    {!isSelf && (
                      <input
                        type="checkbox"
                        name="user_ids"
                        value={p.id}
                        form="bulk-staff-form"
                        className="w-3.5 h-3.5 rounded border-line accent-brand"
                      />
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.full_name} className="w-8 h-8 text-[11px]" />
                      <div>
                        <p className="font-semibold text-foreground">
                          {p.full_name}
                          {isSelf && <span className="text-faint font-normal"> (you)</span>}
                        </p>
                        <p className="text-xs text-muted">{p.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-muted">{ROLE_LABEL[p.role] || p.role}</td>
                  <td className="px-6 py-3 text-muted">{p.department || "—"}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-6 py-3 text-faint text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-3 text-right">
                    {!isSelf && (
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/staff/people${qs({ edit: p.id })}`} className="text-accent-dark text-xs font-semibold hover:underline">
                          Edit
                        </Link>
                        <form action={setUserStatus.bind(null, p.id, p.status === "active" ? "deactivated" : "active")}>
                          <ConfirmSubmitButton
                            confirmMessage={
                              p.status === "active" ? `Deactivate ${p.full_name}? They won't be able to sign in.` : `Reactivate ${p.full_name}?`
                            }
                            className={`text-xs font-semibold hover:underline ${p.status === "active" ? "text-critical" : "text-accent-dark"}`}
                          >
                            {p.status === "active" ? "Deactivate" : "Reactivate"}
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {staffRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-faint text-sm">
                  No matching staff members.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="p-0 overflow-hidden mb-8">
        <p className="text-sm font-bold text-foreground px-6 pt-5 pb-3">Candidates ({candidateRows.length})</p>
        <form
          id="bulk-candidates-form"
          action={bulkPeopleAction}
          className="flex flex-wrap items-center gap-2.5 px-6 py-3 border-y border-line bg-surface/60"
        >
          <span className="text-xs font-semibold text-muted">Bulk action:</span>
          <select
            name="bulk_action"
            className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="activate">Activate</option>
            <option value="deactivate">Deactivate</option>
            <option value="resend_invite">Resend invite</option>
            <option value="set_role">Change role to…</option>
          </select>
          <select
            name="bulk_role"
            className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {grantableAllRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <ConfirmSubmitButton
            confirmMessage="Apply this bulk action to everyone selected below?"
            className="bg-brand text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg hover:bg-brand-light transition-colors"
          >
            Apply to selected
          </ConfirmSubmitButton>
          <span className="text-[11px] text-faint">Select candidates in the table below, then apply.</span>
        </form>
        <table className="w-full text-sm">
          <thead className="text-faint text-[11px] uppercase tracking-wider border-y border-line">
            <tr>
              <th className="px-6 py-3 w-8">
                <SelectAllCheckbox formId="bulk-candidates-form" name="user_ids" />
              </th>
              <th className="text-left px-6 py-3 font-semibold">Name</th>
              <th className="text-left px-6 py-3 font-semibold">Department</th>
              <th className="text-left px-6 py-3 font-semibold">Status</th>
              <th className="text-left px-6 py-3 font-semibold">Added</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {candidateRows.map((p) => (
              <tr key={p.id}>
                <td className="px-6 py-3">
                  <input
                    type="checkbox"
                    name="user_ids"
                    value={p.id}
                    form="bulk-candidates-form"
                    className="w-3.5 h-3.5 rounded border-line accent-brand"
                  />
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.full_name} className="w-8 h-8 text-[11px]" />
                    <div>
                      <p className="font-semibold text-foreground">{p.full_name}</p>
                      <p className="text-xs text-muted">{p.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3 text-muted">{p.department || "—"}</td>
                <td className="px-6 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-6 py-3 text-faint text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/staff/people${qs({ edit: p.id })}`} className="text-accent-dark text-xs font-semibold hover:underline">
                      Edit
                    </Link>
                    <form action={resendInvite.bind(null, p.email)}>
                      <button className="text-accent-dark text-xs font-semibold hover:underline">Resend invite</button>
                    </form>
                    <form action={setUserStatus.bind(null, p.id, p.status === "active" ? "deactivated" : "active")}>
                      <ConfirmSubmitButton
                        confirmMessage={
                          p.status === "active" ? `Deactivate ${p.full_name}? They won't be able to sign in.` : `Reactivate ${p.full_name}?`
                        }
                        className={`text-xs font-semibold hover:underline ${p.status === "active" ? "text-critical" : "text-accent-dark"}`}
                      >
                        {p.status === "active" ? "Deactivate" : "Reactivate"}
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {candidateRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-faint text-sm">
                  No matching candidates.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="p-0 overflow-hidden">
        <p className="text-sm font-bold text-foreground px-6 pt-5 pb-1 flex items-center gap-2">
          <Icon name="clock" className="w-4 h-4 text-brand" />
          Activity log
        </p>
        <p className="text-xs text-muted px-6 pb-4">Last {audit.length} admin action{audit.length === 1 ? "" : "s"} — invites, role changes, and deactivations.</p>
        {audit.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-faint">No admin actions logged yet.</p>
        ) : (
          <div className="divide-y divide-line border-t border-line">
            {audit.map((a) => (
              <div key={a.id} className="px-6 py-3 text-sm flex flex-wrap items-baseline gap-x-1.5">
                <span className="font-semibold text-foreground">{a.actor?.full_name || "Someone"}</span>
                <span className="text-muted">{AUDIT_LABEL[a.action] || a.action.replace(/_/g, " ")}</span>
                {a.target?.full_name && <span className="font-semibold text-foreground">{a.target.full_name}</span>}
                <span className="text-faint text-xs ml-auto">{new Date(a.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
