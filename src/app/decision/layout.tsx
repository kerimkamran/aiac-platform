import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { homeFor } from "@/lib/home";

export default async function DecisionLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, role, status").eq("id", user.id).single();

  if (!profile) redirect("/login");
  if (profile.status === "deactivated") {
    await supabase.auth.signOut();
    redirect("/login?error=deactivated");
  }
  if (profile.role !== "decision_maker") redirect(homeFor(profile.role));

  // Decision makers have no navigation: the deck is the whole product for them.
  return (
    <AppShell role={profile.role} name={profile.full_name} homeHref="/decision" links={[]} showSearch={false}>
      {children}
    </AppShell>
  );
}
