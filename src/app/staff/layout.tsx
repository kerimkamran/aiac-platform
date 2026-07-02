import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NavShell } from "@/components/NavShell";

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

  return (
    <NavShell
      role={profile.role}
      name={profile.full_name}
      links={[
        { href: "/staff", label: "Home", icon: "home", exact: true },
        { href: "/staff/candidates", label: "Candidates", icon: "users" },
        { href: "/staff/builder", label: "Assessment Builder", icon: "layers" },
      ]}
    >
      {children}
    </NavShell>
  );
}
