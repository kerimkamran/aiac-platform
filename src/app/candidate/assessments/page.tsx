import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, EmptyState, Icon, JourneyTracker, PageHeader, StatusBadge } from "@/components/ui";

export default async function CandidateAssessmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assessments } = await supabase
    .from("candidate_assessments")
    .select("id, status, invited_at, assessments(title, description, time_limit_minutes)")
    .eq("candidate_id", user!.id)
    .order("invited_at", { ascending: false });

  const list = (assessments || []) as unknown as {
    id: string;
    status: string;
    invited_at: string;
    assessments: { title: string; description: string; time_limit_minutes: number } | null;
  }[];

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <PageHeader title="My assessments" subtitle="Everything you've been invited to, from first invitation to final review." />

      {list.length === 0 && (
        <EmptyState
          title="No assessments yet"
          body="When a recruiter invites you to an assessment, it appears here automatically."
        />
      )}

      <div className="space-y-4">
        {list.map((a) => (
          <Card key={a.id} className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h2 className="font-bold text-foreground">{a.assessments?.title}</h2>
                <p className="text-sm text-muted mt-1 max-w-xl">{a.assessments?.description}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-5 pt-4 border-t border-line">
              <JourneyTracker status={a.status} />
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-xs text-faint">
                  <Icon name="timer" className="w-3.5 h-3.5" />
                  {a.assessments?.time_limit_minutes} min limit
                </span>
                {["invited", "in_progress"].includes(a.status) ? (
                  <Link
                    href={`/candidate/assessments/${a.id}`}
                    className="inline-flex items-center gap-2 text-sm bg-brand text-white px-4 py-2 rounded-xl font-semibold hover:bg-brand-light transition-colors"
                  >
                    {a.status === "invited" ? "Start assessment" : "Continue"}
                    <Icon name="arrowRight" className="w-3.5 h-3.5" />
                  </Link>
                ) : a.status === "reviewed" ? (
                  <Link
                    href={`/candidate/results/${a.id}`}
                    className="inline-flex items-center gap-2 text-sm border border-line px-4 py-2 rounded-xl font-semibold text-foreground hover:border-accent hover:text-accent-dark transition-colors"
                  >
                    <Icon name="award" className="w-4 h-4" />
                    View results
                  </Link>
                ) : (
                  <span className="text-xs font-medium text-muted">Under review — results coming soon</span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
