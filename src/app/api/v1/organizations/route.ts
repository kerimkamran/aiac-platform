import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { guard, logAudit } from "../_lib";

export async function GET(request: NextRequest) {
  const g = await guard(request, "organizations", "view");
  if ("response" in g) return g.response;
  const supabase = await createClient();
  const [{ data: orgs }, { data: units, error }] = await Promise.all([
    supabase.from("organizations").select("id, name, business_unit"),
    supabase.from("org_units").select("id, organization_id, parent_id, unit_type, name").order("name"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: { organizations: orgs || [], units: units || [] } });
}

export async function POST(request: NextRequest) {
  const g = await guard(request, "organizations", "update");
  if ("response" in g) return g.response;
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.unit_type) return NextResponse.json({ error: "name and unit_type are required" }, { status: 422 });

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("org_units")
    .insert({ organization_id: org?.id ?? null, parent_id: body.parent_id ?? null, unit_type: String(body.unit_type), name: String(body.name) })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit({ module: "api", action: "org_unit_created", targetType: "org_unit", targetId: data.id });
  return NextResponse.json({ data }, { status: 201 });
}
