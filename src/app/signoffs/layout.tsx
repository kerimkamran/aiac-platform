import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell, type NavLink } from "@/components/AppShell";
import { homeFor } from "@/lib/home";

// Manager sign-off requests are open to anyone who has been asked, whatever
// their role, so this page sits outside the role areas (E-10).
export default async function SignoffsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/signoffs");

  const { data: profile } = await supabase.from("profiles").select("full_name, role, status").eq("id", user.id).single();
  if (!profile || profile.status !== "active") redirect("/login?error=inactive");

  const home = homeFor(profile.role);
  const links: NavLink[] = [
    { href: home, label: "Home", icon: "home" },
    { href: "/signoffs", label: "Sign-off requests", icon: "checkCircle", exact: true },
  ];
  return (
    <AppShell role={profile.role} name={profile.full_name} homeHref={home} links={links} defaultCanvas="cream">
      {children}
    </AppShell>
  );
}
