import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { requireRole, STAFF_ROLES } from "@/lib/authz";

export const runtime = "nodejs";

/** Org-wide analytics workbook (Phase 3): the two views leadership asks HR
 *  for at quarter-end -- a competency heatmap by department, and the
 *  pipeline funnel per assessment with conversion rates. */
export async function GET() {
  await requireRole(...STAFF_ROLES);
  const supabase = await createClient();

  const [{ data: caRows }, { data: compRows }] = await Promise.all([
    supabase
      .from("candidate_assessments")
      .select("id, status, overall_score, candidate:profiles!candidate_assessments_candidate_id_fkey(department), assessments(title)"),
    supabase
      .from("candidate_competency_scores")
      .select("candidate_assessment_id, score, competencies(name, category)"),
  ]);

  type Ca = { id: string; status: string; overall_score: number | null; candidate: { department: string | null } | null; assessments: { title: string } | null };
  type Comp = { candidate_assessment_id: string; score: number; competencies: { name: string; category: string } | null };
  const cas = (caRows || []) as unknown as Ca[];
  const comps = (compRows || []) as unknown as Comp[];

  const deptByCa = new Map(cas.map((c) => [c.id, c.candidate?.department || "Unassigned"]));
  const departments = Array.from(new Set(Array.from(deptByCa.values()))).sort();

  // competency -> dept -> scores[]
  const heat = new Map<string, { category: string; byDept: Map<string, number[]> }>();
  for (const row of comps) {
    if (!row.competencies) continue;
    const dept = deptByCa.get(row.candidate_assessment_id) || "Unassigned";
    const entry = heat.get(row.competencies.name) || { category: row.competencies.category, byDept: new Map() };
    const arr = entry.byDept.get(dept) || [];
    arr.push(row.score);
    entry.byDept.set(dept, arr);
    heat.set(row.competencies.name, entry);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Vantage";

  const heatSheet = wb.addWorksheet("Competency heatmap");
  heatSheet.addRow(["Competency", "Category", ...departments, "Org avg", "N scores"]);
  heatSheet.getRow(1).font = { bold: true };
  const sortedComp = Array.from(heat.entries()).sort((a, b) => a[1].category.localeCompare(b[1].category) || a[0].localeCompare(b[0]));
  for (const [name, { category, byDept }] of sortedComp) {
    const all: number[] = [];
    const deptAvgs = departments.map((d) => {
      const arr = byDept.get(d) || [];
      all.push(...arr);
      return arr.length ? Math.round((arr.reduce((x, y) => x + y, 0) / arr.length) * 10) / 10 : null;
    });
    const orgAvg = all.length ? Math.round((all.reduce((x, y) => x + y, 0) / all.length) * 10) / 10 : null;
    heatSheet.addRow([name, category, ...deptAvgs, orgAvg, all.length]);
  }
  heatSheet.columns.forEach((col) => {
    col.width = Math.max(14, ...(col.values || []).map((v) => String(v ?? "").length + 2));
  });

  const funnelSheet = wb.addWorksheet("Pipeline funnel");
  funnelSheet.addRow(["Assessment", "Invited", "Started", "Submitted", "AI scored", "Reviewed", "Start rate", "Completion rate", "Review rate"]);
  funnelSheet.getRow(1).font = { bold: true };
  const byAssessment = new Map<string, Ca[]>();
  for (const c of cas) {
    const title = c.assessments?.title || "Untitled";
    const arr = byAssessment.get(title) || [];
    arr.push(c);
    byAssessment.set(title, arr);
  }
  const pct = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : "—");
  for (const [title, arr] of Array.from(byAssessment.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const invited = arr.length;
    const started = arr.filter((c) => c.status !== "invited").length;
    const submitted = arr.filter((c) => ["submitted", "scored", "reviewed"].includes(c.status)).length;
    const scored = arr.filter((c) => ["scored", "reviewed"].includes(c.status)).length;
    const reviewed = arr.filter((c) => c.status === "reviewed").length;
    funnelSheet.addRow([title, invited, started, submitted, scored, reviewed, pct(started, invited), pct(submitted, invited), pct(reviewed, invited)]);
  }
  funnelSheet.columns.forEach((col) => {
    col.width = Math.max(12, ...(col.values || []).map((v) => String(v ?? "").length + 2));
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `vantage-analytics-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
