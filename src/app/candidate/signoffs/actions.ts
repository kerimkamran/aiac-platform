"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function decideManagerSignoff(signoffId: string, decision: "approved" | "declined", formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const comment = String(formData.get("comment") || "");

  // No role gate here by design: any authenticated user can attempt this, but
  // RLS's "signoffs manager decide own" policy (manager_id = auth.uid()) is
  // the actual authorization boundary -- the update simply matches zero rows
  // for anyone who isn't the assigned manager on this specific sign-off.
  await supabase
    .from("promotion_signoffs")
    .update({ status: decision, comment, decided_at: new Date().toISOString() })
    .eq("id", signoffId)
    .eq("manager_id", user.id);

  revalidatePath("/candidate/signoffs");
}
