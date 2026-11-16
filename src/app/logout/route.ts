import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function POST() {
  const supabase = await createClient();
  try {
    await supabase.rpc("log_admin_event", {
      p_module: "auth",
      p_action: "logout",
      p_target_type: null,
      p_target_id: null,
      p_details: null,
      p_ip: null,
      p_result: "success",
    });
  } catch {}
  // Only this browser: signing out here must not end the person's other sessions (INV-B-33).
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
