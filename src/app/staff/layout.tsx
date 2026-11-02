import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell, type NavLink } from "@/components/AppShell";
import { homeFor } from "@/lib/home";

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
    redirect("/login?error=deactivated");
  }
  if (profile.role === "candidate" || profile.role === "decision_maker") redirect(homeFor(profile.role));

  const isAdmin = profile.role === "hr_admin" || profile.role === "system_admin" || profile.role === "org_admin";
  const isSystemAdmin = profile.role === "system_admin";

  const { count: myInvites } = await supabase
    .from("candidate_assessments")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", user.id);

  // Staff navigation (Clear Horizon plan, section 15): Home, Assessments,
  // Candidates and Reports, plus People and Settings for admins.
  const links: NavLink[] = [
    { href: "/staff", label: "Home", icon: "home", exact: true },
    { href: "/staff/builder", label: "Assessments", icon: "layers" },
    { href: "/staff/reports/candidates", label: "Candidates", icon: "users" },
    { href: "/staff/reports", label: "Reports", icon: "chart", exact: true },
  ];
  if (isAdmin) {
    links.push({ href: "/staff/people", label: "People", icon: "shield" });
    links.push({ href: "/staff/settings", label: "Settings", icon: "sliders" });
  }

  const switchLinks: NavLink[] = [];
  if (isSystemAdmin) switchLinks.push({ href: "/admin", label: "Admin", icon: "command" });
  if ((myInvites ?? 0) > 0) switchLinks.push({ href: "/candidate", label: "My assessments", icon: "clipboard" });

  const actions: NavLink[] = [{ href: "/staff/builder/new", label: "New assessment", icon: "plus" }];
  if (isAdmin) {
    actions.push({ href: "/staff/people#add-candidate", label: "Add a candidate", icon: "plus" });
    actions.push({ href: "/staff/people#add-staff", label: "Add a staff member", icon: "plus" });
    actions.push({ href: "/staff/people#bulk-upload", label: "Bulk-add candidates (CSV)", icon: "download" });
  }
  actions.push({ href: "/staff/review", label: "Start review mode", icon: "play" });

  return (
    <AppShell role={profile.role} name={profile.full_name} homeHref="/staff" links={links} actions={actions} switchLinks={switchLinks} showCredit>
      {children}
    </AppShell>
  );
}
