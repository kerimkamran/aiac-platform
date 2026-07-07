import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const started = Date.now();
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("competencies").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw error;
    return NextResponse.json({ status: "ok", db: "reachable", latency_ms: Date.now() - started });
  } catch {
    return NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503 });
  }
}
