import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { guard } from "../_lib";

export async function GET(request: NextRequest) {
  const g = await guard(request, "roles", "view");
  if ("response" in g) return g.response;
  const supabase = await createClient();
  const { data, error } = await supabase.from("permissions").select("id, module, action").order("module").order("action");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
