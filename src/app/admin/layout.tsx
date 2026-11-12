import { redirect } from "next/navigation";
import { AppShell, type NavLink } from "@/components/AppShell";
import { getSessionProfile, ADMIN_ROLES } from "@/lib/authz";
import { AdminSidebar } from "./AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "active") redirect("/login?error=inactive");
  if (!ADMIN_ROLES.includes(profile.role as (typeof ADMIN_ROLES)[number])) redirect("/staff");

  // The logo is the way to the system horizon; the top bar carries the way back to the workspace; the
  // sub-pages live in the side rail (AdminSidebar). The notification bell now
  // sits in the top bar with everyone else's.
  const links: NavLink[] = [
    { href: "/staff", label: "Workspace", icon: "arrowLeft" },
  ];
  const switchLinks: NavLink[] = [{ href: "/staff", label: "Workspace", icon: "home" }];

  return (
    <AppShell role={profile.role} name={profile.full_name} homeHref="/admin" links={links} contextLabel="Admin" switchLinks={switchLinks} showCredit>
      <AdminSidebar>{children}</AdminSidebar>
    </AppShell>
  );
}
