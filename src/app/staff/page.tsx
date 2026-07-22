import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Avatar, Icon, ScoreBadge, StatusBadge, bandFor } from "@/components/ui";
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

  const recent = list.filter((r) => r.submitted_at).slice(0, 6);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="max-w-[1180px] mx-auto px-6 lg:px-10">
      <div className="pt-10 pb-6 flex items-baseline justify-between gap-4 flex-wrap">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Good to see you, {firstName}</h1>
        <span className="text-[13px] text-faint">{today}</span>
      </div>

      {pendingReview.length > 0 && (
        <Link
          href={`/staff/reports/candidates/${pendingReview[0].id}`}
          className="flex items-center justify-between gap-4 py-3.5 mb-8 border-t border-b border-line group"
        >
          <p className="text-[13.5px] text-muted flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            <span className="text-foreground font-semibold">{pendingReview.length} candidate{pendingReview.length > 1 ? "s" : ""}</span>
            scored by the AI engine and waiting on your review
          </p>
          <span className="text-[12.5px] font-semibold text-accent inline-flex items-center gap-1.5 shrink-0 group-hover:underline">
            Review now
            <Icon name="arrowRight" className="w-3.5 h-3.5" />
          </span>
        </Link>
      )}

      <div className="grid lg:grid-cols-[1fr_300px]">
        {/* Wide content column */}
        <div className="lg:pr-14 lg:border-r border-line pb-14">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13.5px] font-semibold text-foreground">Recent submissions</p>
            <Link href="/staff/reports/candidates" className="text-[12.5px] font-medium text-faint hover:text-muted">
              All candidates
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="text-[13.5px] text-faint py-8 border-t border-line">
              Nothing submitted yet — publish an assessment and invite candidates from People &amp; Access.
            </p>
          ) : (
            <div className="border-t border-line">
              {recent.map((r) => (
                <Link
                  key={r.id}
                  href={`/staff/reports/candidates/${r.id}`}
                  className="flex items-center gap-3.5 py-3.5 border-b border-line-soft hover:bg-line-soft/40 transition-colors -mx-2 px-2"
                >
                  <Avatar name={r.candidate?.full_name || "?"} className="w-7 h-7 text-[10.5px]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate">{r.candidate?.full_name}</p>
                    <p className="text-[11.5px] text-faint truncate">{r.assessments?.title}</p>
                  </div>
                  <StatusBadge status={r.status} />
                  {r.overall_score !== null && <ScoreBadge score={Math.round(r.overall_score)} />}
                </Link>
              ))}
            </div>
          )}

          <p className="text-[13.5px] font-semibold text-foreground mt-10 mb-4">Role fit distribution</p>
          {scored.length > 0 ? (
            <BandDistribution buckets={bands} />
          ) : (
            <p className="text-[13px] text-faint py-8 border-t border-line">No scored candidates yet.</p>
          )}
        </div>

        {/* Narrow stats rail */}
        <div className="lg:pl-14 pt-10 lg:pt-0 pb-14">
          <p className="text-[11px] font-semibold text-faint uppercase tracking-wide mb-5">This week</p>

          <div className="mb-6">
            <p className="text-[32px] font-semibold tracking-tight text-foreground tabular-nums leading-none">{list.length}</p>
            <p className="text-[12.5px] text-faint mt-1.5">in the pipeline</p>
          </div>
          <div className="mb-6">
            <p className="text-[32px] font-semibold tracking-tight text-accent tabular-nums leading-none">{pendingReview.length}</p>
            <p className="text-[12.5px] text-faint mt-1.5">waiting on you</p>
          </div>
          <div className="mb-6">
            <p className="text-[32px] font-semibold tracking-tight text-foreground tabular-nums leading-none">{avg ?? "—"}</p>
            <p className="text-[12.5px] text-faint mt-1.5">average role fit</p>
          </div>
          <div>
            <p className="text-[32px] font-semibold tracking-tight text-foreground tabular-nums leading-none">{publishedCount ?? 0}</p>
            <p className="text-[12.5px] text-faint mt-1.5">published assessments</p>
          </div>

          <div className="mt-10 pt-6 border-t border-line">
            <p className="text-[11px] font-semibold text-faint uppercase tracking-wide mb-3.5">Pipeline funnel</p>
            <PipelineFunnel stages={funnel} />
          </div>

          <Link
            href="/staff/builder"
            className="mt-10 flex items-center justify-center gap-2 bg-foreground text-background text-[13px] font-semibold py-2.5 rounded-md hover:opacity-90 transition-opacity"
          >
            <Icon name="plus" className="w-4 h-4" />
            New assessment
          </Link>
        </div>
      </div>
    </div>
  );
}
