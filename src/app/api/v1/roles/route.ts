import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { guard } from "../_lib";

export async function GET(request: NextRequest) {
  const g = await guard(request, "roles", "view");
  if ("response" in g) return g.response;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role_permissions")
    .select("role, permissions(module, action)")
    .order("role");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const matrix: Record<string, string[]> = {};
  for (const row of data || []) {
    const p = row.permissions as unknown as { module: string; action: string } | null;
    if (!p) continue;
    (matrix[row.role as string] ||= []).push(`${p.module}.${p.action}`);
  }
  return NextResponse.json({ data: matrix });
}
