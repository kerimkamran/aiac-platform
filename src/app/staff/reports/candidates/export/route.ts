import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { HEADER_FILL, HEADER_FONT, brandWorksheet } from "@/lib/excel-style";
import { buildCandidateAssessmentQuery, chunk, fetchAllRows } from "@/lib/candidate-filters";
import { EXCEL_COPY } from "@/lib/excel-copy";
import { pdfLang } from "@/lib/pdf-copy";
import { getT } from "@/i18n/server";

export const runtime = "nodejs";

// STF-B-16: this used to run one unbounded query (truncating silently at the
// API's row-limit cap for a large, filtered export) and then re-applied the
// q/department/vacancy filters in JS -- which could drift from what the list
// page shows, since that page now filters server-side via the same shared
// helper. "Export selected" (an explicit, UI-capped ids list) still runs a
// single direct query; "export all (filtered)" now pages through every
// matching row with fetchAllRows, and the follow-up score/review lookups are
// chunked so a large export can't build an oversized .in() filter either.
const EXPORT_SELECT =
  "id, status, overall_score, invited_at, submitted_at, tab_switch_count, candidate:__CANDIDATE_REL__(full_name, email, department), assessments:__ASSESSMENT_REL__(title, vacancy_title)";
const LOOKUP_CHUNK_SIZE = 200;

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

export async function GET(req: Request) {
  const supabase = await requireStaff();
  if (!supabase) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const url = new URL(req.url);
  const ids = url.searchParams.get("ids");
  const status = url.searchParams.get("status") || "";
  const q = url.searchParams.get("q") || "";
  const department = url.searchParams.get("department") || "";
  const vacancy = url.searchParams.get("vacancy") || "";

  let list: Row[];

  if (ids) {
    // "Export selected" -- a UI-capped list of ids from one page of results,
    // so an unbounded single query is fine here.
    const idList = ids.split(",").map((s) => s.trim()).filter(Boolean);
    const { data: rows } = idList.length
      ? await supabase
          .from("candidate_assessments")
          .select(
            "id, status, overall_score, invited_at, submitted_at, tab_switch_count, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email, department), assessments(title, vacancy_title)"
          )
          .in("id", idList)
          .order("invited_at", { ascending: false })
      : { data: [] };
    list = (rows || []) as unknown as Row[];
  } else {
    // "Export all (filtered)" -- same filters as the list page, same shared
    // helper, paged through in chunks instead of one unbounded fetch.
    list = await fetchAllRows<Row>(() => {
      // The embedded-resource select string isn't a literal the Supabase
      // client can type against, so its .range() result comes back typed as
      // an error-shaped row; cast it to what it actually returns at runtime.
      const filtered = buildCandidateAssessmentQuery(supabase, EXPORT_SELECT, { status, q, department, vacancy }).order("invited_at", {
        ascending: false,
      });
      return {
        range: (from: number, to: number) => filtered.range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: unknown }>,
      };
    }, 500);
  }

  const ids2 = list.map((r) => r.id);

  type ScoreRow = { candidate_assessment_id: string; score: number; level: string; competencies: { name: string; category: string } | null };
  type ReviewRow = { candidate_assessment_id: string; decision: string; comment: string; created_at: string; reviewer: { full_name: string } | null };

  const scoresByCa = new Map<string, ScoreRow[]>();
  const reviewsByCa = new Map<string, ReviewRow[]>();

  for (const idBatch of chunk(ids2, LOOKUP_CHUNK_SIZE)) {
    const [{ data: scoreBatch }, { data: reviewBatch }] = await Promise.all([
      supabase
        .from("candidate_competency_scores")
        .select("candidate_assessment_id, score, level, competencies(name, category)")
        .in("candidate_assessment_id", idBatch),
      supabase
        .from("candidate_reviews")
        .select("candidate_assessment_id, decision, comment, created_at, reviewer:profiles!candidate_reviews_reviewer_id_fkey(full_name)")
        .in("candidate_assessment_id", idBatch)
        .order("created_at", { ascending: false }),
    ]);
    for (const s of (scoreBatch || []) as unknown as ScoreRow[]) {
      const arr = scoresByCa.get(s.candidate_assessment_id) || [];
      arr.push(s);
      scoresByCa.set(s.candidate_assessment_id, arr);
    }
    for (const r of (reviewBatch || []) as unknown as ReviewRow[]) {
      const arr = reviewsByCa.get(r.candidate_assessment_id) || [];
      arr.push(r);
      reviewsByCa.set(r.candidate_assessment_id, arr);
    }
  }

  const categoryAvg = (rows: ScoreRow[], cat: string) => {
    const vals = rows.filter((r) => r.competencies?.category === cat).map((r) => r.score);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vantage by Azerconnect Group";
  workbook.created = new Date();

  // Batch 29: headers and fixed values in the downloader's own language.
  const x = EXCEL_COPY[pdfLang((await getT()).lang)];
  const sheet = workbook.addWorksheet(x.sheet, { views: [{ state: "frozen", ySplit: 1 }] });

  const h = x.headers;
  sheet.columns = [
    { header: h.name, key: "name", width: 26 },
    { header: h.email, key: "email", width: 30 },
    { header: h.department, key: "department", width: 22 },
    { header: h.assessment, key: "assessment", width: 26 },
    { header: h.vacancy, key: "vacancy", width: 22 },
    { header: h.status, key: "status", width: 18 },
    { header: h.overall, key: "overall", width: 18 },
    { header: h.core, key: "core", width: 14 },
    { header: h.leadership, key: "leadership", width: 16 },
    { header: h.functional, key: "functional", width: 18 },
    { header: h.tabSwitches, key: "tabSwitches", width: 16 },
    { header: h.invitedAt, key: "invitedAt", width: 18 },
    { header: h.submittedAt, key: "submittedAt", width: 18 },
    { header: h.decision, key: "decision", width: 22 },
    { header: h.decidedBy, key: "decidedBy", width: 20 },
    { header: h.comment, key: "comment", width: 40 },
  ];

  sheet.getRow(1).font = HEADER_FONT;
  sheet.getRow(1).fill = HEADER_FILL;
  brandWorksheet(sheet);
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
      status: x.status[r.status] ?? r.status,
      overall: r.overall_score !== null ? Math.round(r.overall_score * 10) / 10 : null,
      core: categoryAvg(compRows, "Core"),
      leadership: categoryAvg(compRows, "Leadership"),
      functional: categoryAvg(compRows, "Functional"),
      tabSwitches: r.tab_switch_count || 0,
      invitedAt: r.invited_at ? new Date(r.invited_at) : null,
      submittedAt: r.submitted_at ? new Date(r.submitted_at) : null,
      decision: latest?.decision ? (x.decision[latest.decision] ?? latest.decision) : "",
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
      "Content-Disposition": `attachment; filename="vantage-candidates-${stamp}.xlsx"`,
    },
  });
}
