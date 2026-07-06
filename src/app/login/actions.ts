"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user!.id)
    .single();

  if (profile?.status === "deactivated") {
    await supabase.auth.signOut();
    redirect("/login?error=" + encodeURIComponent("This account has been deactivated. Contact your administrator."));
  }

  if (profile?.role === "candidate") redirect("/candidate");
  if (profile?.role === "decision_maker") redirect("/decision");
  redirect("/staff");
}
