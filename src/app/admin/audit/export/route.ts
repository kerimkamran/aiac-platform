import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, logAudit } from "@/lib/authz";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("audit", "export");
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;
  let query = supabase
    .from("admin_audit_log")
    .select("created_at, module, action, target_type, target_id, ip, result, details, actor:profiles!admin_audit_log_actor_id_fkey(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (sp.get("module")) query = query.eq("module", sp.get("module")!);
  if (sp.get("q")) query = query.ilike("action", `%${sp.get("q")}%`);
  if (sp.get("from")) query = query.gte("created_at", sp.get("from")!);
  if (sp.get("to")) query = query.lte("created_at", sp.get("to")! + "T23:59:59Z");

  const { data: events } = await query;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Audit");
  ws.columns = [
    { header: "Timestamp", key: "created_at", width: 22 },
    { header: "Actor", key: "actor_name", width: 24 },
    { header: "Actor Email", key: "actor_email", width: 28 },
    { header: "Module", key: "module", width: 14 },
    { header: "Action", key: "action", width: 22 },
    { header: "Target Type", key: "target_type", width: 14 },
    { header: "Target ID", key: "target_id", width: 38 },
    { header: "IP", key: "ip", width: 16 },
    { header: "Result", key: "result", width: 10 },
    { header: "Details", key: "details", width: 50 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const e of events || []) {
    const actor = e.actor as unknown as { full_name: string; email: string } | null;
    ws.addRow({
      ...e,
      actor_name: actor?.full_name || "System",
      actor_email: actor?.email || "",
      details: e.details ? JSON.stringify(e.details) : "",
    });
  }

  await logAudit({ module: "audit", action: "exported", details: { count: events?.length ?? 0 } });

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="aiac-audit-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
