import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const staffRoles = ["hr_admin", "system_admin", "recruiter", "hiring_manager"];
  if (!profile || !staffRoles.includes(profile.role)) return null;
  return supabase;
}

export async function GET(req: Request) {
  const supabase = await requireStaff();
  if (!supabase) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const url = new URL(req.url);
  const ids = url.searchParams.get("ids");
  const status = url.searchParams.get("status") || "";
  const q = url.searchParams.get("q") || "";
  const department = url.searchParams.get("department") || "";
  const vacancy = url.searchParams.get("vacancy") || "";

  let query = supabase
    .from("candidate_assessments")
    .select(
      "id, status, overall_score, invited_at, submitted_at, tab_switch_count, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email, department), assessments(title, vacancy_title)"
    )
    .order("invited_at", { ascending: false });

  if (ids) {
    const idList = ids.split(",").map((s) => s.trim()).filter(Boolean);
    if (idList.length > 0) query = query.in("id", idList);
  }
  if (status) query = query.eq("status", status);

  const { data: rows } = await query;

  type Row = {
    id: string;
    status: string;
    overall_score: number | null;
    invited_at: string;
    submitted_at: string | null;
    tab_switch_count: number | null;
    candidate: { full_name: string; email: string; department: string | null } | null;
    assessments: { title: string; vacancy_title: string | null } | null;
  };

  let list = (rows || []) as unknown as Row[];

  if (q) {
    const needle = q.toLowerCase();
    list = list.filter(
      (r) =>
        r.candidate?.full_name?.toLowerCase().includes(needle) ||
        r.candidate?.email?.toLowerCase().includes(needle) ||
        r.assessments?.title?.toLowerCase().includes(needle)
    );
  }
  if (department) list = list.filter((r) => (r.candidate?.department || "").toLowerCase() === department.toLowerCase());
  if (vacancy) list = list.filter((r) => (r.assessments?.vacancy_title || r.assessments?.title || "") === vacancy);

  const ids2 = list.map((r) => r.id);

  const [{ data: allScores }, { data: allReviews }] = await Promise.all([
    ids2.length
      ? supabase
          .from("candidate_competency_scores")
          .select("candidate_assessment_id, score, level, competencies(name, category)")
          .in("candidate_assessment_id", ids2)
      : Promise.resolve({ data: [] }),
    ids2.length
      ? supabase
          .from("candidate_reviews")
          .select("candidate_assessment_id, decision, comment, created_at, reviewer:profiles!candidate_reviews_reviewer_id_fkey(full_name)")
          .in("candidate_assessment_id", ids2)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  type ScoreRow = { candidate_assessment_id: string; score: number; level: string; competencies: { name: string; category: string } | null };
  type ReviewRow = { candidate_assessment_id: string; decision: string; comment: string; created_at: string; reviewer: { full_name: string } | null };

  const scoresByCa = new Map<string, ScoreRow[]>();
  for (const s of (allScores || []) as unknown as ScoreRow[]) {
    const arr = scoresByCa.get(s.candidate_assessment_id) || [];
    arr.push(s);
    scoresByCa.set(s.candidate_assessment_id, arr);
  }

  const reviewsByCa = new Map<string, ReviewRow[]>();
  for (const r of (allReviews || []) as unknown as ReviewRow[]) {
    const arr = reviewsByCa.get(r.candidate_assessment_id) || [];
    arr.push(r);
    reviewsByCa.set(r.candidate_assessment_id, arr);
  }

  const categoryAvg = (rows: ScoreRow[], cat: string) => {
    const vals = rows.filter((r) => r.competencies?.category === cat).map((r) => r.score);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AI Assessment Center by Azerconnect Group";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Candidates", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.columns = [
    { header: "Full Name", key: "name", width: 26 },
    { header: "Email", key: "email", width: 30 },
    { header: "Department / Structure", key: "department", width: 22 },
    { header: "Assessment", key: "assessment", width: 26 },
    { header: "Vacancy", key: "vacancy", width: 22 },
    { header: "Status", key: "status", width: 16 },
    { header: "Overall Role Fit", key: "overall", width: 16 },
    { header: "Core Avg", key: "core", width: 12 },
    { header: "Leadership Avg", key: "leadership", width: 14 },
    { header: "Functional Avg", key: "functional", width: 14 },
    { header: "Tab Switches", key: "tabSwitches", width: 12 },
    { header: "Invited At", key: "invitedAt", width: 18 },
    { header: "Submitted At", key: "submittedAt", width: 18 },
    { header: "Latest Decision", key: "decision", width: 14 },
    { header: "Decided By", key: "decidedBy", width: 20 },
    { header: "Decision Comment", key: "comment", width: 40 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D3D8C" } };
  sheet.getRow(1).height = 22;

  for (const r of list) {
    const compRows = scoresByCa.get(r.id) || [];
    const reviews = reviewsByCa.get(r.id) || [];
    const latest = reviews[0];

    sheet.addRow({
      name: r.candidate?.full_name || "",
      email: r.candidate?.email || "",
      department: r.candidate?.department || "",
      assessment: r.assessments?.title || "",
      vacancy: r.assessments?.vacancy_title || "",
      status: r.status,
      overall: r.overall_score !== null ? Math.round(r.overall_score * 10) / 10 : null,
      core: categoryAvg(compRows, "Core"),
      leadership: categoryAvg(compRows, "Leadership"),
      functional: categoryAvg(compRows, "Functional"),
      tabSwitches: r.tab_switch_count || 0,
      invitedAt: r.invited_at ? new Date(r.invited_at) : null,
      submittedAt: r.submitted_at ? new Date(r.submitted_at) : null,
      decision: latest?.decision || "",
      decidedBy: latest?.reviewer?.full_name || "",
      comment: latest?.comment || "",
    });
  }

  sheet.getColumn("invitedAt").numFmt = "yyyy-mm-dd";
  sheet.getColumn("submittedAt").numFmt = "yyyy-mm-dd";
  sheet.autoFilter = { from: "A1", to: "P1" };

  const buffer = await workbook.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="aiac-candidates-${stamp}.xlsx"`,
    },
  });
}
