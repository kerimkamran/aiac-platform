import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Full admin activity log as a downloadable CSV -- Settings page only
 *  shows the most recent entries inline; this returns the complete
 *  history (no limit) so admins can archive or audit outside the app.
 *  Admin / Super Admin only, same gate as the Settings page itself. */
export async function GET() {
  await requireRole("hr_admin", "system_admin");
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("admin_audit_log")
    .select(
      "id, action, details, created_at, actor:profiles!admin_audit_log_actor_id_fkey(full_name, email), target:profiles!admin_audit_log_target_user_id_fkey(full_name, email)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  type Row = {
    id: string;
    action: string;
    details: Record<string, unknown> | null;
    created_at: string;
    actor: { full_name: string; email: string } | null;
    target: { full_name: string; email: string } | null;
  };
  const list = (rows || []) as unknown as Row[];

  const header = ["Timestamp", "Actor", "Actor email", "Action", "Target", "Target email", "Details"];
  const lines = [header.map(csvEscape).join(",")];
  for (const r of list) {
    lines.push(
      [
        new Date(r.created_at).toISOString(),
        r.actor?.full_name || "",
        r.actor?.email || "",
        r.action,
        r.target?.full_name || "",
        r.target?.email || "",
        r.details ? JSON.stringify(r.details) : "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  const csv = lines.join("\n");
  const filename = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
