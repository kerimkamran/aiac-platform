import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NavShell, type NavLink } from "@/components/NavShell";

export default async function DecisionLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();

  if (!profile) redirect("/login");
  if (profile.role === "candidate") redirect("/candidate");
  if (profile.role !== "decision_maker") redirect("/staff");

  const links: NavLink[] = [{ href: "/decision", label: "Assigned candidates", icon: "users", exact: true }];

  return (
    <NavShell role={profile.role} name={profile.full_name} links={links}>
      {children}
    </NavShell>
  );
}
