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
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.role === "candidate") redirect("/candidate");
  if (profile.role === "decision_maker") redirect("/decision");

  const isAdmin = profile.role === "hr_admin" || profile.role === "system_admin";

  const links: NavLink[] = [
    { href: "/staff", label: "Home", icon: "home", exact: true },
    { href: "/staff/candidates", label: "Candidates", icon: "users" },
    { href: "/staff/builder", label: "Assessment Builder", icon: "layers" },
  ];
  if (isAdmin) {
    links.push({ href: "/staff/people", label: "People & Access", icon: "shield" });
    links.push({ href: "/staff/settings", label: "Settings", icon: "grid" });
  }

  return (
    <NavShell role={profile.role} name={profile.full_name} links={links}>
      {children}
    </NavShell>
  );
}
