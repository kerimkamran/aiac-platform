import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Avatar, Card, Icon, PageHeader, ScoreBadge, StatusBadge } from "@/components/ui";

export default async function DecisionHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assignments } = await supabase
    .from("candidate_decision_makers")
    .select(
      "candidate_assessment_id, assigned_at, candidate_assessments(id, status, overall_score, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email), assessments(title, vacancy_title))"
    )
    .eq("profile_id", user.id)
    .order("assigned_at", { ascending: false });

  type Row = {
    candidate_assessment_id: string;
    candidate_assessments: {
      id: string;
      status: string;
      overall_score: number | null;
      candidate: { full_name: string; email: string } | null;
      assessments: { title: string; vacancy_title: string | null } | null;
    } | null;
  };

  const rows = ((assignments || []) as unknown as Row[]).filter((r) => r.candidate_assessments);

  // My own decisions, so we can show "You decided" vs "Awaiting your decision"
  const ids = rows.map((r) => r.candidate_assessment_id);
  const { data: myReviews } = ids.length
    ? await supabase.from("candidate_reviews").select("candidate_assessment_id, decision").eq("reviewer_id", user.id).in("candidate_assessment_id", ids)
    : { data: [] as { candidate_assessment_id: string; decision: string }[] };

  const decidedIds = new Set((myReviews || []).map((r) => r.candidate_assessment_id));

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader
        title="Assigned candidates"
        subtitle="Candidates HR has asked you to review. Open a candidate to see their full Role Fit report and submit your decision."
      />

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-faint text-[11px] uppercase tracking-wider border-b border-line">
            <tr>
              <th className="text-left px-5 py-3.5 font-semibold">Candidate</th>
              <th className="text-left px-5 py-3.5 font-semibold">Role / Vacancy</th>
              <th className="text-left px-5 py-3.5 font-semibold">Status</th>
              <th className="text-left px-5 py-3.5 font-semibold">Role Fit</th>
              <th className="text-left px-5 py-3.5 font-semibold">Your decision</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const ca = r.candidate_assessments!;
              return (
                <tr key={ca.id} className="hover:bg-background/70 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={ca.candidate?.full_name || "?"} />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{ca.candidate?.full_name}</p>
                        <p className="text-xs text-muted truncate">{ca.candidate?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted">{ca.assessments?.vacancy_title || ca.assessments?.title}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={ca.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    {ca.overall_score !== null ? <ScoreBadge score={Math.round(ca.overall_score)} /> : <span className="text-faint">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {decidedIds.has(ca.id) ? (
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-dark">
                        <Icon name="checkCircle" className="w-3.5 h-3.5" />
                        Submitted
                      </span>
                    ) : (
                      <span className="text-[12.5px] text-amber-600 font-medium">Awaiting your input</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/decision/candidates/${ca.id}`}
                      className="inline-flex items-center gap-1.5 text-accent-dark font-semibold whitespace-nowrap hover:underline"
                    >
                      Review
                      <Icon name="arrowRight" className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-faint text-sm">
                  No candidates assigned to you yet — HR will assign you from a candidate&apos;s review page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
