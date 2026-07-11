import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Avatar, Card, Icon, PageHeader, ScoreBadge, StatCard, StatusBadge, bandFor } from "@/components/ui";
import { BandDistribution, PipelineFunnel } from "@/components/charts";

type Row = {
  id: string;
  status: string;
  overall_score: number | null;
  submitted_at: string | null;
  invited_at: string;
  candidate: { full_name: string; email: string } | null;
  assessments: { title: string } | null;
};

export default async function StaffHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: rows }, { count: publishedCount }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).single(),
    supabase
      .from("candidate_assessments")
      .select(
        "id, status, overall_score, submitted_at, invited_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email), assessments(title)"
      )
      .order("invited_at", { ascending: false }),
    supabase.from("assessments").select("id", { count: "exact", head: true }).eq("status", "published"),
  ]);

  const list = (rows || []) as unknown as Row[];
  const scored = list.filter((r) => r.overall_score !== null);
  const pendingReview = list.filter((r) => r.status === "scored");
  const avg = scored.length ? Math.round((scored.reduce((s, r) => s + (r.overall_score || 0), 0) / scored.length) * 10) / 10 : null;
  const firstName = (profile?.full_name || "there").split(" ")[0];

  const bands = [
    { label: "Does Not Meet", test: (s: number) => s < 50 },
    { label: "Partially Meets", test: (s: number) => s >= 50 && s < 70 },
    { label: "Fully Meets", test: (s: number) => s >= 70 && s < 85 },
    { label: "Exceeds", test: (s: number) => s >= 85 },
  ].map((b) => ({
    label: b.label,
    count: scored.filter((r) => b.test(r.overall_score!)).length,
    hex: bandFor(b.label === "Does Not Meet" ? 0 : b.label === "Partially Meets" ? 50 : b.label === "Fully Meets" ? 70 : 85).hex,
  }));

  const funnel = [
    { label: "Invited", count: list.length },
    { label: "Started", count: list.filter((r) => r.status !== "invited").length },
    { label: "AI scored", count: list.filter((r) => ["scored", "reviewed"].includes(r.status)).length },
    { label: "Reviewed", count: list.filter((r) => r.status === "reviewed").length },
  ];

  const recent = list.filter((r) => r.submitted_at).slice(0, 5);

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        subtitle="Your talent pipeline at a glance — assessments, scores, and what needs your review."
      >
        <Link
          href="/staff/builder"
          className="inline-flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-light transition-colors"
        >
          <Icon name="plus" className="w-4 h-4" />
          New assessment
        </Link>
      </PageHeader>

      {/* Review queue callout */}
      {pendingReview.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-chart-3/[0.06] squircle px-6 py-5 mb-10 anim-fade-up" style={{ boxShadow: "var(--shadow-xs)" }}>
          <p className="text-sm text-foreground flex items-center gap-3.5">
            <span className="w-9 h-9 squircle-sm bg-chart-3/10 text-chart-3 grid place-items-center shrink-0">
              <Icon name="eye" className="w-4 h-4" />
            </span>
            <span>
              <span className="font-semibold">{pendingReview.length} candidate{pendingReview.length > 1 ? "s" : ""}</span> scored
              by the AI engine and waiting for human review.
            </span>
          </p>
          <Link
            href={`/staff/candidates/${pendingReview[0].id}`}
            className="text-sm font-semibold text-accent-dark hover:underline inline-flex items-center gap-1.5"
          >
            Start reviewing
            <Icon name="arrowRight" className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard label="Candidates in pipeline" value={list.length} icon="users" tone="brand" emphasis />
        <StatCard label="Awaiting human review" value={pendingReview.length} icon="eye" tone="violet" />
        <StatCard label="Avg. Role Fit Score" value={avg ?? "—"} icon="target" tone="accent" />
        <StatCard label="Published assessments" value={publishedCount ?? 0} icon="layers" tone="amber" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6 mb-10">
        <Card className="p-7">
          <p className="text-sm font-semibold text-foreground mb-1">Role Fit distribution</p>
          <p className="text-[13px] text-muted mb-6">Scored candidates per proficiency band</p>
          {scored.length > 0 ? (
            <BandDistribution buckets={bands} />
          ) : (
            <p className="text-sm text-faint py-10 text-center">No scored candidates yet.</p>
          )}
        </Card>
        <Card className="p-7">
          <p className="text-sm font-semibold text-foreground mb-1">Pipeline funnel</p>
          <p className="text-[13px] text-muted mb-6">Where candidates are in the journey</p>
          <PipelineFunnel stages={funnel} />
        </Card>
      </div>

      {/* Recent submissions */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-7 pt-6 pb-5">
          <p className="text-sm font-semibold text-foreground">Recent submissions</p>
          <Link href="/staff/candidates" className="text-[13px] font-semibold text-accent-dark hover:underline inline-flex items-center gap-1.5">
            All candidates
            <Icon name="arrowRight" className="w-3.5 h-3.5" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-7 pb-7 text-sm text-faint">Nothing submitted yet — publish an assessment and invite candidates from the builder.</p>
        ) : (
          <div className="divide-y divide-line border-t border-line">
            {recent.map((r) => (
              <Link key={r.id} href={`/staff/candidates/${r.id}`} className="flex items-center gap-4 px-7 py-4 hover:bg-line-soft transition-colors">
                <Avatar name={r.candidate?.full_name || "?"} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{r.candidate?.full_name}</p>
                  <p className="text-xs text-muted truncate">{r.assessments?.title}</p>
                </div>
                <StatusBadge status={r.status} />
                {r.overall_score !== null && <ScoreBadge score={Math.round(r.overall_score)} />}
                <Icon name="arrowRight" className="w-4 h-4 text-faint" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
