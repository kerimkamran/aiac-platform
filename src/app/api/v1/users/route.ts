import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { guard, parsePagination, envelope, logAudit } from "../_lib";
import { provisionAccount, sendInvite } from "@/lib/invite";

export async function GET(request: NextRequest) {
  const g = await guard(request, "users", "view");
  if ("response" in g) return g.response;

  const supabase = await createClient();
  const { page, perPage, from, to } = parsePagination(request);
  const sp = request.nextUrl.searchParams;

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, phone, job_title, department, business_unit, location, role, status, is_employee, manager_id, org_unit_id, last_login_at, created_at", { count: "exact" });
  // PostgREST filter values are comma/paren-sensitive; strip them (and %) so
  // user input can't alter the .or() expression.
  const q = sp.get("q")?.trim().replace(/[,%()]/g, "");
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
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
  const account = await provisionAccount(supabase, {
    email: String(body.email),
    fullName: String(body.full_name),
    role: String(body.role || "candidate"),
    department: body.department ? String(body.department) : null,
  });
  if (!account.ok) return NextResponse.json({ error: account.error }, { status: 400 });

  // A new account is invited by email, like every other way of adding people.
  let inviteSent = false;
  if (account.created) inviteSent = (await sendInvite(String(body.email))) === null;

  await logAudit({ module: "api", action: "user_created", targetType: "user", targetId: account.id, details: { email: body.email, invite_sent: inviteSent } });
  return NextResponse.json(
    { data: { profile_id: account.id, created: account.created, invite_sent: inviteSent } },
    { status: 201 }
  );
}
