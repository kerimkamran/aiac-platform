import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { guard, logAudit } from "../../_lib";

const EDITABLE = [
  "full_name", "phone", "job_title", "department", "business_unit", "location",
  "manager_id", "org_unit_id", "is_employee", "employee_id", "hire_date",
  "expertise", "availability", "max_workload", "custom_fields",
] as const;

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(request, "users", "view");
  if ("response" in g) return g.response;
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ module: "pii_access", action: "api_profile_read", targetType: "user", targetId: id });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(request, "users", "update");
  if ("response" in g) return g.response;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 422 });

  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE) if (key in body) patch[key] = body[key];
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No editable fields in body" }, { status: 422 });

  const supabase = await createClient();

  if (typeof body.role === "string") {
    const { error } = await supabase.rpc("admin_update_user_role", { p_user_id: id, p_role: body.role, p_department: body.department ?? null });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (typeof body.status === "string") {
    const { error } = await supabase.rpc("admin_set_user_status", { p_user_id: id, p_status: body.status });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit({ module: "api", action: "user_updated", targetType: "user", targetId: id, details: { fields: Object.keys(patch) } });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(request, "users", "delete");
  if ("response" in g) return g.response;
  const { id } = await ctx.params;
  const supabase = await createClient();
  // Soft delete: deactivate. GDPR erasure is a separate, explicit anonymize operation.
  const { error } = await supabase.rpc("admin_set_user_status", { p_user_id: id, p_status: "deactivated" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit({ module: "api", action: "user_deactivated", targetType: "user", targetId: id });
  return NextResponse.json({ data: { id, status: "deactivated" } });
}
