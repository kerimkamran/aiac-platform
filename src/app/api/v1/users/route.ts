import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { guard, parsePagination, envelope, logAudit } from "../_lib";

export async function GET(request: NextRequest) {
  const g = await guard(request, "users", "view");
  if ("response" in g) return g.response;

  const supabase = await createClient();
  const { page, perPage, from, to } = parsePagination(request);
  const sp = request.nextUrl.searchParams;

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, phone, job_title, department, business_unit, location, role, status, is_employee, manager_id, org_unit_id, last_login_at, created_at", { count: "exact" });
  if (sp.get("q")) query = query.or(`full_name.ilike.%${sp.get("q")}%,email.ilike.%${sp.get("q")}%`);
  if (sp.get("role")) query = query.eq("role", sp.get("role")!);
  if (sp.get("status")) query = query.eq("status", sp.get("status")!);
  const sort = sp.get("sort") || "created_at";
  const order = sp.get("order") === "asc";
  const sortCol = ["full_name", "email", "role", "status", "last_login_at", "created_at"].includes(sort) ? sort : "created_at";

  const { data, count, error } = await query.order(sortCol, { ascending: order }).range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return envelope(data, { page, perPage, total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const g = await guard(request, "users", "create");
  if ("response" in g) return g.response;

  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.full_name) {
    return NextResponse.json({ error: "email and full_name are required" }, { status: 422 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_provision_user", {
    p_email: String(body.email),
    p_full_name: String(body.full_name),
    p_role: String(body.role || "candidate"),
    p_department: body.department ? String(body.department) : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAudit({ module: "api", action: "user_created", targetType: "user", targetId: data?.[0]?.profile_id, details: { email: body.email } });
  return NextResponse.json({ data: data?.[0] ?? null }, { status: 201 });
}
