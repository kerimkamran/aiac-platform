import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell, type NavLink } from "@/components/AppShell";
import { homeFor } from "@/lib/home";

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

  const links: NavLink[] = [
    { href: "/candidate", label: "Home", icon: "home", exact: true },
    { href: "/candidate/assessments", label: "My assessments", icon: "clipboard" },
    { href: "/candidate/results", label: "Results", icon: "award" },
  ];
  if ((directReportCount ?? 0) > 0) {
    links.push({ href: "/candidate/signoffs", label: "Sign-off requests", icon: "checkCircle" });
  }

  // Internal employees who are also candidates get a way back to their workspace.
  const switchLinks: NavLink[] = isInternal ? [{ href: homeFor(profile.role), label: "Back to workspace", icon: "arrowLeft" }] : [];

  return (
    <AppShell role={profile.role} name={profile.full_name} homeHref="/candidate" links={links} switchLinks={switchLinks} defaultCanvas="cream">
      {children}
    </AppShell>
  );
}
