import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NavShell, type NavLink } from "@/components/NavShell";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, status")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.status === "deactivated") {
    await supabase.auth.signOut();
    redirect("/login?error=" + encodeURIComponent("This account has been deactivated. Contact your administrator."));
  }
  if (profile.role === "candidate") redirect("/candidate");
  if (profile.role === "decision_maker") redirect("/decision");

  const isAdmin =
    profile.role === "hr_admin" || profile.role === "system_admin" || profile.role === "org_admin";

  const { count: myInvites } = await supabase
    .from("candidate_assessments")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", user.id);

  const links: NavLink[] = [
    { href: "/staff", label: "Home", icon: "home", exact: true },
    { href: "/staff/candidates", label: "Candidates", icon: "users" },
    { href: "/staff/reports", label: "Reports & Analytics", icon: "trending" },
    { href: "/staff/talent-matrix", label: "Talent Matrix", icon: "chart" },
    { href: "/staff/builder", label: "Assessment Builder", icon: "layers" },
  ];
  if (isAdmin) {
    links.push({ href: "/staff/people", label: "People & Access", icon: "shield" });
    links.push({ href: "/staff/settings", label: "Settings", icon: "grid" });
  }
  if (profile.role === "system_admin") {
    links.push({ href: "/staff/case-library", label: "Case Library", icon: "brain" });
  }
  if (isAdmin) {
    links.push({ href: "/admin", label: "Admin Panel", icon: "command" });
  }
  if ((myInvites ?? 0) > 0) {
    links.push({ href: "/candidate/assessments", label: "My Assessments", icon: "clipboard" });
  }

  const actions: NavLink[] = [{ href: "/staff/builder", label: "New assessment", icon: "plus" }];
  if (isAdmin) {
    actions.push({ href: "/staff/people#add-candidate", label: "Add a candidate", icon: "plus" });
    actions.push({ href: "/staff/people#add-staff", label: "Add a staff member", icon: "plus" });
    actions.push({ href: "/staff/people#bulk-upload", label: "Bulk-add candidates (CSV)", icon: "download" });
  }

  return (
    <NavShell role={profile.role} name={profile.full_name} links={links} actions={actions}>
      {children}
    </NavShell>
  );
}
