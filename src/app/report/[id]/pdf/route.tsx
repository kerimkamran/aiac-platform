import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { CandidateReportDocument, type ReportData } from "@/lib/pdf-report";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select(
      "id, assessment_id, overall_score, submitted_at, tab_switch_count, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email, department), assessments(title, vacancy_title)"
    )
    .eq("id", id)
    .single();

  // RLS (candidate own / staff / assigned decision maker) already scoped the row away if unauthorized.
  if (!ca) return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });

  const candidate = ca.candidate as unknown as { full_name: string; email: string; department: string | null } | null;
  const assessment = ca.assessments as unknown as { title: string; vacancy_title: string | null } | null;

  const { data: peerScoresRaw } = await supabase
    .from("candidate_assessments")
    .select("overall_score")
    .eq("assessment_id", ca.assessment_id)
    .not("overall_score", "is", null);
  const peerScores = ((peerScoresRaw || []) as { overall_score: number }[]).map((p) => p.overall_score);
  const peerCount = peerScores.length;
  const percentile =
    ca.overall_score !== null && peerCount > 1
      ? Math.round((peerScores.filter((s) => s < ca.overall_score!).length / (peerCount - 1)) * 100)
      : null;

  const [{ data: competencyScores }, { data: responses }, { data: reviews }] = await Promise.all([
    supabase
      .from("candidate_competency_scores")
      .select("score, level, competencies(name, category)")
      .eq("candidate_assessment_id", id),
    supabase
      .from("candidate_responses")
      .select("response_text, selected_option, score, ai_rationale, questions(prompt, question_type, options)")
      .eq("candidate_assessment_id", id),
    supabase
      .from("candidate_reviews")
      .select("decision, comment, created_at, reviewer:profiles!candidate_reviews_reviewer_id_fkey(full_name)")
      .eq("candidate_assessment_id", id)
      .order("created_at", { ascending: false }),
  ]);

  type QOpt = { key: string; text: string };
  const data: ReportData = {
    candidateName: candidate?.full_name || "Candidate",
    candidateEmail: candidate?.email || "",
    assessmentTitle: assessment?.title || "Assessment",
    vacancyTitle: assessment?.vacancy_title || null,
    department: candidate?.department || null,
    overallScore: ca.overall_score,
    percentile,
    peerCount,
    submittedAt: ca.submitted_at,
    tabSwitchCount: ca.tab_switch_count || 0,
    competencies: ((competencyScores || []) as unknown as { score: number; level: string; competencies: { name: string; category: string } | null }[])
      .filter((c) => c.competencies)
      .map((c) => ({ name: c.competencies!.name, category: c.competencies!.category, score: c.score, level: c.level }))
      .sort((a, b) => b.score - a.score),
    responses: ((responses || []) as unknown as {
      response_text: string | null;
      selected_option: string | null;
      score: number;
      ai_rationale: string;
      questions: { prompt: string; question_type: string; options: QOpt[] | null } | null;
    }[]).map((r) => ({
      prompt: r.questions?.prompt || "",
      answer:
        r.questions?.question_type === "mcq"
          ? r.questions?.options?.find((o) => o.key === r.selected_option)?.text || r.selected_option || ""
          : r.response_text || "",
      score: r.score,
      rationale: r.ai_rationale,
    })),
    decisions: ((reviews || []) as unknown as { decision: string; comment: string; created_at: string; reviewer: { full_name: string } | null }[]).map(
      (d) => ({ decision: d.decision, comment: d.comment, reviewer: d.reviewer?.full_name || "Reviewer", createdAt: d.created_at })
    ),
    generatedAt: new Date().toISOString(),
  };

  const buffer = await renderToBuffer(<CandidateReportDocument data={data} />);

  const filename = `${(candidate?.full_name || "candidate").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-report.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
