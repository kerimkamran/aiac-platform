import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, EmptyState, Icon, PageHeader, ScoreRing, bandFor } from "@/components/ui";

export default async function CandidateResultsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("candidate_assessments")
    .select("id, status, overall_score, submitted_at, assessments(title)")
    .eq("candidate_id", user!.id)
    .in("status", ["submitted", "scored", "reviewed"])
    .order("submitted_at", { ascending: false });

  const list = (rows || []) as unknown as {
    id: string;
    status: string;
    overall_score: number | null;
    submitted_at: string | null;
    assessments: { title: string } | null;
  }[];

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <PageHeader
        title="My results"
        subtitle="Results unlock once a human reviewer has confirmed your AI-assisted scores."
      />

      {list.length === 0 && (
        <EmptyState
          icon="award"
          title="No results yet"
          body="Complete an assessment and your competency profile will appear here after review."
          action={{ href: "/candidate/assessments", label: "Go to my assessments" }}
        />
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {list.map((r) => {
          const ready = r.status === "reviewed" && r.overall_score !== null;
          return (
            <Card key={r.id} className="p-6">
              <p className="font-semibold text-foreground mb-1">{r.assessments?.title}</p>
              <p className="text-xs text-faint mb-5">
                Submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "—"}
              </p>
              {ready ? (
                <div className="flex items-center justify-between gap-4">
                  <ScoreRing score={Math.round(r.overall_score!)} size={84} label={bandFor(r.overall_score!).label} />
                  <Link
                    href={`/candidate/results/${r.id}`}
                    className="inline-flex items-center gap-2 text-sm bg-brand text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-brand-light transition-colors"
                  >
                    Full profile
                    <Icon name="arrowRight" className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-background border border-line rounded-xl px-4 py-3 text-sm text-muted">
                  <Icon name="clock" className="w-4 h-4 shrink-0" />
                  Under review — a reviewer is confirming your scores.
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
