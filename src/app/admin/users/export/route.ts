import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, logAudit } from "@/lib/authz";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("users", "export");
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, phone, job_title, department, business_unit, location, role, status, is_employee, employee_id, last_login_at, created_at")
    .order("created_at", { ascending: false })
    .limit(10000);
  // PostgREST filter values are comma/paren-sensitive; strip them (and %) so
  // user input can't alter the .or() expression.
  const q = sp.get("q")?.trim().replace(/[,%()]/g, "");
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,department.ilike.%${q}%`);
  if (sp.get("role")) query = query.eq("role", sp.get("role")!);
  if (sp.get("status")) query = query.eq("status", sp.get("status")!);
  if (sp.get("type") === "employee") query = query.eq("is_employee", true);
  if (sp.get("type") === "external") query = query.eq("is_employee", false);

  const { data: users } = await query;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Users");
  ws.columns = [
    { header: "User ID", key: "id", width: 38 },
    { header: "Full Name", key: "full_name", width: 26 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Job Title", key: "job_title", width: 22 },
    { header: "Department", key: "department", width: 20 },
    { header: "Business Unit", key: "business_unit", width: 20 },
    { header: "Location", key: "location", width: 16 },
    { header: "Role", key: "role", width: 16 },
    { header: "Status", key: "status", width: 12 },
    { header: "Employee", key: "is_employee", width: 10 },
    { header: "Employee ID", key: "employee_id", width: 14 },
    { header: "Last Login", key: "last_login_at", width: 20 },
    { header: "Created", key: "created_at", width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const u of users || []) ws.addRow(u);

  await logAudit({ module: "users", action: "exported", details: { count: users?.length ?? 0 } });

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="aiac-users-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
