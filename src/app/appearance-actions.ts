"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeAppearance, type Appearance } from "@/lib/appearance";

// Reads the signed-in user's saved appearance (null when signed out or unset).
export async function loadMyAppearance(): Promise<Appearance | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("appearance").eq("id", user.id).maybeSingle();
  const raw = (data as { appearance?: unknown } | null)?.appearance;
  if (!raw || typeof raw !== "object" || Object.keys(raw as object).length === 0) return null;
  return normalizeAppearance(raw);
}

// Saves the choice to the profile. Failures are ignored on purpose: the
// browser copy already applies, and the next visit tries again.
export async function saveMyAppearance(next: Appearance): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const clean = normalizeAppearance(next);
  await supabase.rpc("set_my_appearance", { p_appearance: clean });
}
