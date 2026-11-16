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
  if (profile.status !== "active") {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }
  if (profile.role === "candidate") redirect(homeFor(profile.role));

  const isAdmin = profile.role === "hr_admin" || profile.role === "system_admin" || profile.role === "org_admin";
  const isSystemAdmin = profile.role === "system_admin";

  const { count: myInvites } = await supabase
    .from("candidate_assessments")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", user.id);

  // Staff navigation (redesign plan B9): at most four places, named for what
  // people do there. Hiring managers have no Tests. People and Settings move to
  // the account menu with the other things nobody opens weekly.
  const links: NavLink[] = [
    { href: "/staff", label: "Home", icon: "home", exact: true },
    { href: "/staff/reports/candidates", label: "Candidates", icon: "users" },
  ];
  if (profile.role !== "hiring_manager") links.push({ href: "/staff/builder", label: "Tests", icon: "layers" });
  links.push({ href: "/staff/review", label: "Reviews", icon: "check" });

  const switchLinks: NavLink[] = [];
  // Managers asked to sign off a promotion review reach it from here too (E-10).
  const { count: reports } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("manager_id", user.id);
  if ((reports ?? 0) > 0) switchLinks.push({ href: "/signoffs", label: "Sign-off requests", icon: "checkCircle" });
  if (isAdmin) {
    switchLinks.push({ href: "/staff/people", label: "People", icon: "shield" });
    switchLinks.push({ href: "/staff/settings", label: "Settings", icon: "sliders" });
  }
  if (isSystemAdmin) switchLinks.push({ href: "/admin", label: "Admin", icon: "command" });
  if ((myInvites ?? 0) > 0) switchLinks.push({ href: "/candidate", label: "My tests", icon: "clipboard" });

  const actions: NavLink[] = [{ href: "/staff/builder/new", label: "New assessment", icon: "plus" }];
  actions.push({ href: "/staff/invite", label: "Invite a candidate", icon: "plus" });
  if (isAdmin) {
    actions.push({ href: "/staff/people#add-staff", label: "Add a staff member", icon: "plus" });
    actions.push({ href: "/staff/people#bulk-upload", label: "Bulk-add candidates (CSV)", icon: "download" });
  }

  return (
    <AppShell role={profile.role} name={profile.full_name} homeHref="/staff" links={links} actions={actions} switchLinks={switchLinks} primaryAction={profile.role !== "hiring_manager" ? { href: "/staff/invite", label: "Invite candidate", icon: "plus" } : undefined} showCredit>
      {children}
    </AppShell>
  );
}
