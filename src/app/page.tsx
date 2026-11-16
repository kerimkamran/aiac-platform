import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/home";

// The front door is the sign-in page (redesign plan B11): no marketing page.
// Signed-in visitors go straight to their own home.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const dest = homeFor(profile?.role);
    if (dest !== "/login") redirect(dest);
  }
  redirect("/login");
}
