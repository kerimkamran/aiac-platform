import { redirect } from "next/navigation";
import { NavShell } from "@/components/NavShell";
import { getSessionProfile, ADMIN_ROLES } from "@/lib/authz";
import { NotificationsBell } from "@/components/NotificationsBell";
import { AdminSidebar } from "./AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "active") redirect("/login?error=" + encodeURIComponent("Account is not active."));
  if (!ADMIN_ROLES.includes(profile.role as (typeof ADMIN_ROLES)[number])) redirect("/staff");

  return (
    // Design-execution-plan Phase 5 / T5.4: the top bar now carries only
    // Admin's two true top-level entries; the eleven sub-pages that used to
    // crowd this same row live in AdminSidebar's persistent rail instead --
    // see that file for the full rationale.
    <NavShell
      role={profile.role}
      name={profile.full_name}
      links={[
        { href: "/admin", label: "Admin Dashboard", icon: "shield", exact: true },
        { href: "/staff", label: "Back to Workspace", icon: "arrowLeft" },
      ]}
    >
      <div className="flex justify-end px-6 pt-4 -mb-10 relative z-10 no-print">
        <NotificationsBell />
      </div>
      <AdminSidebar>{children}</AdminSidebar>
    </NavShell>
  );
}
