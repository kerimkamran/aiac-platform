import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, EmptyState, Icon, JourneyTracker, PageHeader, StatCard, StatusBadge } from "@/components/ui";

type Row = {
  id: string;
  status: string;
  invited_at: string;
  assessments: { title: string; time_limit_minutes: number } | null;
};

export default async function CandidateDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: assessments }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).single(),
    supabase
      .from("candidate_assessments")
      .select("id, status, invited_at, assessments(title, time_limit_minutes)")
      .eq("candidate_id", user!.id)
      .order("invited_at", { ascending: false }),
  ]);

  const list = (assessments || []) as unknown as Row[];
  const invited = list.filter((a) => a.status === "invited");
  const inProgress = list.filter((a) => a.status === "in_progress");
  const done = list.filter((a) => ["submitted", "scored", "reviewed"].includes(a.status));
  const reviewed = list.filter((a) => a.status === "reviewed");
  const firstName = (profile?.full_name || "there").split(" ")[0];
  const next = inProgress[0] || invited[0];

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="This is your assessment home — pick up where you left off, or review your results."
      />

      {/* Hero action */}
      {next ? (
        <div className="relative overflow-hidden hero-mesh rounded-2xl text-white p-7 md:p-8 mb-8 anim-fade-up">
          <div className="absolute inset-0 hero-grid-overlay" aria-hidden />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent mb-2">
                {next.status === "in_progress" ? "Continue where you left off" : "Up next for you"}
              </p>
              <h2 className="text-xl md:text-2xl font-bold [font-family:var(--font-display)]">{next.assessments?.title}</h2>
              <p className="text-sm text-white/60 mt-1.5 flex items-center gap-2">
                <Icon name="timer" className="w-4 h-4" />
                {next.assessments?.time_limit_minutes} minute time limit · answers save automatically
              </p>
            </div>
            <Link
              href={`/candidate/assessments/${next.id}`}
              className="inline-flex items-center gap-2 bg-accent px-6 py-3 rounded-xl font-semibold hover:bg-accent-dark transition-colors shadow-lg shadow-accent/25"
            >
              {next.status === "in_progress" ? "Continue assessment" : "Start assessment"}
              <Icon name="arrowRight" className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : list.length === 0 ? (
        <div className="mb-8">
          <EmptyState
            icon="clipboard"
            title="No invitations yet"
            body="You'll be invited to an assessment using this account's email address — for hiring, promotion, or development. You'll see it here the moment it lands."
          />
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="To start" value={invited.length} icon="clipboard" tone="amber" />
        <StatCard label="In progress" value={inProgress.length} icon="clock" tone="brand" />
        <StatCard label="Completed" value={done.length} icon="checkCircle" tone="accent" />
        <StatCard label="Results ready" value={reviewed.length} icon="award" tone="violet" />
      </div>

      {/* Recent assessments */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-foreground [font-family:var(--font-display)]">Your assessments</h2>
        <Link href="/candidate/assessments" className="inline-flex items-center gap-1.5 text-sm text-accent-dark font-semibold hover:underline">
          View all
          <Icon name="arrowRight" className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-3">
        {list.slice(0, 4).map((a) => (
          <Card key={a.id} className="p-5 flex flex-wrap items-center justify-between gap-5">
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{a.assessments?.title}</p>
              <p className="text-xs text-muted mt-1">
                {a.assessments?.time_limit_minutes} min · invited {new Date(a.invited_at).toLocaleDateString()}
              </p>
            </div>
            <div className="hidden md:block">
              <JourneyTracker status={a.status} />
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={a.status} />
              {["invited", "in_progress"].includes(a.status) ? (
                <Link
                  href={`/candidate/assessments/${a.id}`}
                  className="text-sm bg-brand text-white px-4 py-2 rounded-xl font-semibold hover:bg-brand-light transition-colors"
                >
                  {a.status === "invited" ? "Start" : "Continue"}
                </Link>
              ) : a.status === "reviewed" ? (
                <Link
                  href={`/candidate/results/${a.id}`}
                  className="text-sm border border-line text-foreground px-4 py-2 rounded-xl font-semibold hover:border-accent hover:text-accent-dark transition-colors"
                >
                  View results
                </Link>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      {/* Tips */}
      <Card className="mt-10 p-6 flex items-start gap-4">
        <span className="w-10 h-10 rounded-xl bg-accent-soft text-accent-dark grid place-items-center shrink-0">
          <Icon name="sparkles" className="w-5 h-5" />
        </span>
        <div className="text-sm text-muted leading-relaxed">
          <p className="font-semibold text-foreground mb-1">How to give your best answers</p>
          For open questions, describe a real <span className="font-medium text-foreground">situation</span>, the{" "}
          <span className="font-medium text-foreground">action you took</span>, and the measurable{" "}
          <span className="font-medium text-foreground">result</span>. Responses are evaluated against Azerconnect&apos;s
          competency behavioural anchors — specific beats generic, every time.
        </div>
      </Card>
    </div>
  );
}
