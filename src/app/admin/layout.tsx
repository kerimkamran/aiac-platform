import { redirect } from "next/navigation";
import { NavShell } from "@/components/NavShell";
import { getSessionProfile, ADMIN_ROLES } from "@/lib/authz";
import { NotificationsBell } from "@/components/NotificationsBell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "active") redirect("/login?error=" + encodeURIComponent("Account is not active."));
  if (!ADMIN_ROLES.includes(profile.role as (typeof ADMIN_ROLES)[number])) redirect("/staff");

  return (
    <NavShell
      role={profile.role}
      name={profile.full_name}
      links={[
        { href: "/admin", label: "Admin Dashboard", icon: "shield", exact: true },
        { href: "/admin/users", label: "Users", icon: "users" },
        { href: "/admin/roles", label: "Roles & Permissions", icon: "check" },
        { href: "/admin/organizations", label: "Organizations", icon: "building" },
        { href: "/admin/approvals", label: "Approvals", icon: "checkCircle" },
        { href: "/admin/audit", label: "Audit Logs", icon: "file" },
        { href: "/admin/notifications", label: "Notifications", icon: "mail" },
        { href: "/admin/security", label: "Security", icon: "ban" },
        { href: "/admin/ai-governance", label: "AI Governance", icon: "brain" },
        { href: "/admin/data-governance", label: "Data Governance", icon: "layers" },
        { href: "/admin/api-docs", label: "API", icon: "command" },
        { href: "/staff", label: "Back to Workspace", icon: "arrowLeft" },
      ]}
    >
      <div className="flex justify-end px-6 pt-4 -mb-10 relative z-10 no-print">
        <NotificationsBell />
      </div>
      {children}
    </NavShell>
  );
}
