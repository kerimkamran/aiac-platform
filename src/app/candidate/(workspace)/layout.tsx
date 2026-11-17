import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell, type NavLink } from "@/components/AppShell";
import { homeFor } from "@/lib/home";
import { getT } from "@/i18n/server";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
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
  const isInternal = profile.role !== "candidate";
  if (isInternal) {
    // Dual audience: internal employees (any role) may take promotion and
    // development assessments they were invited to; without invitations, back
    // to their own home.
    const { count } = await supabase
      .from("candidate_assessments")
      .select("id", { count: "exact", head: true })
      .eq("candidate_id", user.id);
    if ((count ?? 0) === 0) redirect(homeFor(profile.role));
  }

  // Anyone who is set as someone else's manager (profiles.manager_id) may have
  // promotion sign-off requests waiting. Show the link only then.
  const { count: directReportCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("manager_id", user.id);

  const { t } = await getT();
  const links: NavLink[] = [
    { href: "/candidate", label: t.candidate.nav.home, icon: "home", exact: true },
    { href: "/candidate/assessments", label: t.candidate.nav.myTests, icon: "clipboard" },
    { href: "/candidate/results", label: t.candidate.nav.myResults, icon: "award" },
  ];

  // Internal employees who are also candidates get a way back to their workspace.
  const switchLinks: NavLink[] = isInternal ? [{ href: homeFor(profile.role), label: t.candidate.nav.backToWorkspace, icon: "arrowLeft" }] : [];
  // Managers asked to sign off a promotion review reach it from the account menu.
  if ((directReportCount ?? 0) > 0) switchLinks.push({ href: "/signoffs", label: t.candidate.nav.signoffRequests, icon: "checkCircle" });

  return (
    <AppShell role={profile.role} name={profile.full_name} homeHref="/candidate" links={links} switchLinks={switchLinks} defaultCanvas="cream">
      {children}
    </AppShell>
  );
}
