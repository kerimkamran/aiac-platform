import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, Icon, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { normalizePurpose } from "@/lib/purpose";

type Row = {
  id: string;
  status: string;
  overall_score: number | null;
  invited_at: string;
  submitted_at: string | null;
  candidate: { full_name: string; email: string; department: string | null } | null;
  assessments: { title: string; purpose: string | null } | null;
};

export default async function PromotionsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ purpose?: string }>;
}) {
  const { purpose: purposeFilter = "" } = await searchParams;
  const supabase = await createClient();

  // Fetch matching assessment ids first rather than relying on a nested
  // embedded-resource filter (assessments!inner + .in("assessments.purpose", ...))
  // -- more predictable across PostgREST/Supabase-JS versions, and this table
  // is small enough that a two-step fetch has no real cost.
  const purposesToMatch = purposeFilter === "promotion" || purposeFilter === "development" ? [purposeFilter] : ["promotion", "development"];
  const { data: matchingAssessments } = await supabase.from("assessments").select("id").in("purpose", purposesToMatch);
  const assessmentIds = (matchingAssessments || []).map((a) => a.id as string);

  const { data: rows } = assessmentIds.length
    ? await supabase
        .from("candidate_assessments")
        .select(
          "id, status, overall_score, invited_at, submitted_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email, department), assessments(title, purpose)"
        )
        .in("assessment_id", assessmentIds)
        .order("invited_at", { ascending: false })
    : { data: [] };

  const list = (rows || []) as unknown as Row[];

  const ids = list.map((r) => r.id);
  const [{ data: reviews }, { data: signoffs }] = await Promise.all([
    ids.length
      ? supabase
          .from("candidate_reviews")
          .select("candidate_assessment_id, decision, created_at")
          .in("candidate_assessment_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from("promotion_signoffs")
          .select("candidate_assessment_id, status")
          .in("candidate_assessment_id", ids)
          .order("requested_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const latestDecision = new Map<string, string>();
  for (const r of (reviews || []) as { candidate_assessment_id: string; decision: string }[]) {
    if (!latestDecision.has(r.candidate_assessment_id)) latestDecision.set(r.candidate_assessment_id, r.decision);
  }
  const latestSignoff = new Map<string, string>();
  for (const s of (signoffs || []) as { candidate_assessment_id: string; status: string }[]) {
    if (!latestSignoff.has(s.candidate_assessment_id)) latestSignoff.set(s.candidate_assessment_id, s.status);
  }

  const promotionCount = list.filter((r) => normalizePurpose(r.assessments?.purpose) === "promotion").length;
  const developmentCount = list.filter((r) => normalizePurpose(r.assessments?.purpose) === "development").length;
  const awaitingReview = list.filter((r) => r.status === "scored").length;
  const recommended = list.filter((r) => latestDecision.get(r.id) === "recommend").length;

  const qs = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ purpose: purposeFilter, ...overrides });
    for (const [k, v] of Array.from(params.entries())) if (!v) params.delete(k);
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader
        title="Promotions & Development"
        subtitle="Internal employee assessments — separate from the hiring pipeline, since decisions, tone, and stakeholders differ."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Promotion reviews" value={promotionCount} icon="trending" tone="brand" />
        <StatCard label="Development plans" value={developmentCount} icon="sparkles" tone="violet" />
        <StatCard label="Awaiting HR review" value={awaitingReview} icon="clock" tone="amber" />
        <StatCard label="Recommended" value={recommended} icon="checkCircle" tone="accent" />
      </div>

      <div className="flex items-center gap-1.5 bg-surface border border-line rounded-xl p-1 w-fit mb-5">
        {[
          { key: "", label: "All" },
          { key: "promotion", label: "Promotion" },
          { key: "development", label: "Development" },
        ].map((f) => (
          <Link
            key={f.key}
            href={`/staff/promotions${qs({ purpose: f.key })}`}
            className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
              purposeFilter === f.key ? "bg-brand text-white" : "text-muted hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="mx-auto w-12 h-12 rounded-2xl bg-brand/8 text-brand grid place-items-center mb-4">
            <Icon name="trending" className="w-6 h-6" />
          </span>
          <p className="font-semibold text-foreground">No promotion or development assessments yet</p>
          <p className="text-sm text-muted mt-1.5 max-w-sm mx-auto">
            Create one from the Assessment Builder and set its purpose to Promotion or Development.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {list.map((r) => {
            const purpose = normalizePurpose(r.assessments?.purpose);
            const decision = latestDecision.get(r.id);
            const signoff = latestSignoff.get(r.id);
            return (
              <Link key={r.id} href={`/staff/candidates/${r.id}`}>
                <Card className="p-5 flex flex-wrap items-center justify-between gap-4 hover:border-brand/40 transition-colors">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{r.candidate?.full_name || "Unknown"}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {r.assessments?.title} · {purpose === "promotion" ? "Promotion" : "Development"}
                      {r.candidate?.department ? ` · ${r.candidate.department}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <StatusBadge status={r.status} />
                    {decision && <StatusBadge status={decision} />}
                    {purpose === "promotion" && signoff && signoff !== "pending" && (
                      <span className="text-[11px] font-semibold text-faint">
                        Manager: {signoff === "approved" ? "Approved" : "Declined"}
                      </span>
                    )}
                    {purpose === "promotion" && signoff === "pending" && (
                      <span className="text-[11px] font-semibold text-amber-600">Manager sign-off pending</span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
