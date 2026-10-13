import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NavShell } from "@/components/NavShell";

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
    redirect("/login?error=" + encodeURIComponent("This account has been deactivated. Contact your administrator."));
  }
  if (profile.role !== "candidate") {
    // Dual audience: internal employees (any role) may take promotion/development
    // assessments they were invited to; without invitations, back to the workspace.
    const { count } = await supabase
      .from("candidate_assessments")
      .select("id", { count: "exact", head: true })
      .eq("candidate_id", user.id);
    if ((count ?? 0) === 0) redirect("/staff");
  }

  // Anyone who is set as someone else's manager (profiles.manager_id) may have
  // promotion sign-off requests waiting -- surface the nav link only then,
  // since most people will never be a manager on this system.
  const { count: directReportCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("manager_id", user.id);

  const links = [
    { href: "/candidate", label: "Home", icon: "home", exact: true },
    { href: "/candidate/assessments", label: "My Assessments", icon: "clipboard" },
    { href: "/candidate/results", label: "My Results", icon: "award" },
  ];
  if ((directReportCount ?? 0) > 0) {
    links.push({ href: "/candidate/signoffs", label: "Sign-off requests", icon: "checkCircle" });
  }

  return (
    <NavShell role={profile.role} name={profile.full_name} links={links}>
      {children}
    </NavShell>
  );
}
