import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { csvLine } from "@/lib/csv";

export const runtime = "nodejs";


/** Full admin activity log as a downloadable CSV -- Settings page only
 *  shows the most recent entries inline; this returns the complete
 *  history (no limit) so admins can archive or audit outside the app.
 *  Admin / Super Admin only, same gate as the Settings page itself. */
export async function GET() {
  // 401 / 403 as JSON instead of an unhandled error (ADM-B-17).
  try {
    await requireRole("hr_admin", "system_admin");
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const supabase = await createClient();

  // The server returns at most 1000 rows per request, so read the whole history
  // in pages instead of silently cutting it off (ADM-B-16).
  const PAGE = 1000;
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await supabase
      .from("admin_audit_log")
      .select(
        "id, action, details, created_at, actor:profiles!admin_audit_log_actor_id_fkey(full_name, email), target:profiles!admin_audit_log_target_user_id_fkey(full_name, email)"
      )
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    rows.push(...(page || []));
    if (!page || page.length < PAGE) break;
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
  const lines = [csvLine(header)];
  for (const r of list) {
    lines.push(
      csvLine([
        new Date(r.created_at).toISOString(),
        r.actor?.full_name || "",
        r.actor?.email || "",
        r.action,
        r.target?.full_name || "",
        r.target?.email || "",
        r.details ? JSON.stringify(r.details) : "",
      ])
    );
  }

  // Byte-order mark so Excel reads Azerbaijani letters correctly.
  const csv = "\uFEFF" + lines.join("\n");
  const filename = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
