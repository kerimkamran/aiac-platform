import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { guard, parsePagination, envelope } from "../_lib";

export async function GET(request: NextRequest) {
  const g = await guard(request, "audit", "view");
  if ("response" in g) return g.response;
  const supabase = await createClient();
  const { page, perPage, from, to } = parsePagination(request);
  const sp = request.nextUrl.searchParams;

  let query = supabase
    .from("admin_audit_log")
    .select("id, actor_id, module, action, target_type, target_id, ip, result, details, created_at", { count: "exact" })
    .order("created_at", { ascending: false });
  if (sp.get("module")) query = query.eq("module", sp.get("module")!);
  if (sp.get("actor_id")) query = query.eq("actor_id", sp.get("actor_id")!);
  if (sp.get("from")) query = query.gte("created_at", sp.get("from")!);
  if (sp.get("to")) query = query.lte("created_at", sp.get("to")!);

  const { data, count, error } = await query.range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return envelope(data, { page, perPage, total: count ?? 0 });
}
