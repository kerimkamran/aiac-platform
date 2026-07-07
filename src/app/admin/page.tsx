import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/authz";
import { Avatar, Card, Icon, PageHeader, StatCard } from "@/components/ui";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const profile = await getSessionProfile();

  const [{ data: roleCounts }, { count: pendingApprovals }, { data: recentAudit }, { count: activeUsers }] = await Promise.all([
    supabase.from("profiles").select("role, status"),
    supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("admin_audit_log")
      .select("id, module, action, result, created_at, actor:profiles!admin_audit_log_actor_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const rows = roleCounts || [];
  const staff = rows.filter((r) => r.role !== "candidate").length;
  const suspended = rows.filter((r) => r.status !== "active").length;

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader
        title={`Admin Panel`}
        subtitle={`Signed in as ${profile?.full_name} (${profile?.role.replace(/_/g, " ")}). Every action here is written to the append-only audit log.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active users" value={activeUsers ?? 0} icon="users" tone="brand" />
        <StatCard label="Staff accounts" value={staff} icon="shield" tone="accent" />
        <StatCard label="Suspended / deactivated" value={suspended} icon="ban" tone="amber" />
        <StatCard label="Pending approvals" value={pendingApprovals ?? 0} icon="checkCircle" tone="violet" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-foreground">Recent admin activity</p>
            <Link href="/admin/audit" className="text-[13px] font-semibold text-accent-dark hover:underline">
              Full audit log
            </Link>
          </div>
          <div className="space-y-3">
            {(recentAudit || []).map((e) => {
              const actor = e.actor as unknown as { full_name: string } | null;
              return (
                <div key={e.id} className="flex items-center gap-3 text-[13px]">
                  <Avatar name={actor?.full_name || "?"} className="w-7 h-7 text-[10px]" />
                  <span className="text-foreground font-medium truncate">{actor?.full_name || "System"}</span>
                  <span className="text-muted truncate">
                    {e.module ? `${e.module} · ` : ""}
                    {e.action.replace(/_/g, " ")}
                  </span>
                  {e.result === "denied" && <span className="text-critical text-[11px] font-bold">DENIED</span>}
                  <span className="text-faint text-[11px] ml-auto whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</span>
                </div>
              );
            })}
            {(!recentAudit || recentAudit.length === 0) && <p className="text-sm text-faint">No activity recorded yet.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-bold text-foreground mb-4">Quick actions</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/admin/users", icon: "users", label: "Manage users" },
              { href: "/staff/people", icon: "send", label: "Invite / bulk import" },
              { href: "/admin/roles", icon: "check", label: "Permission matrix" },
              { href: "/admin/approvals", icon: "checkCircle", label: "Review approvals" },
              { href: "/admin/security", icon: "ban", label: "Security settings" },
              { href: "/admin/audit", icon: "file", label: "Audit & export" },
            ].map((a) => (
              <Link
                key={a.href + a.label}
                href={a.href}
                className="flex items-center gap-2.5 border border-line rounded-xl px-3.5 py-3 text-[13px] font-semibold text-foreground hover:border-accent transition-colors"
              >
                <Icon name={a.icon} className="w-4 h-4 text-accent-dark" />
                {a.label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
