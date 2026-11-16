import type { SupabaseClient } from "@supabase/supabase-js";

// HR-granted extra minutes per attempt (migration 0018). Read on its own so a
// database without the column still shows the base time limit.
export async function extraMinutesFor(supabase: SupabaseClient, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const { data, error } = await supabase.from("candidate_assessments").select("id, extra_minutes").in("id", ids);
  if (error) return out;
  for (const r of (data || []) as { id: string; extra_minutes: number | null }[]) out.set(r.id, r.extra_minutes ?? 0);
  return out;
}
