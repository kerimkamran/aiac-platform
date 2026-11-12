import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { EmptyState, StatusBadge } from "@/components/ui";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ListRow, PrimaryCard } from "@/components/ui/Surfaces";
import { PathHorizon, type PathStep } from "@/components/horizon/PathHorizon";
import { dueLabel, greeting } from "@/lib/dates";

type Row = {
  id: string;
  status: string;
  invited_at: string;
  due_at: string | null;
  assessments: { title: string; time_limit_minutes: number } | null;
};

const STEPS = ["Invited", "Taking it", "Submitted", "Being reviewed", "Result"];
const CURRENT: Record<string, number> = { invited: 0, in_progress: 1, submitted: 2, scored: 3, reviewed: 4 };

function pathFor(status: string): PathStep[] {
  const cur = CURRENT[status] ?? 0;
  return STEPS.map((label, i) => ({ label, state: i < cur ? "done" : i === cur ? "current" : "todo" }));
}

// Candidate home (Clear Horizon plan, section 11): one next step, your place on
// the path, and plain-language statuses. A person reviews every score, so the
// words "AI scored" never appear here.
export default async function CandidateHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: assessments }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).single(),
    supabase
      .from("candidate_assessments")
      .select("id, status, invited_at, due_at, assessments(title, time_limit_minutes)")
      .eq("candidate_id", user!.id)
      .order("invited_at", { ascending: false }),
  ]);

  const list = (assessments || []) as unknown as Row[];
  const next = list.find((a) => a.status === "in_progress") || list.find((a) => a.status === "invited");
  const focus = next || list[0];
  const firstName = (profile?.full_name || "").split(" ")[0];

  return (
    <div className="container-page max-w-4xl py-8 lg:py-12">
      <p className="text-mono-label text-muted">
        {greeting()}
        {firstName ? `, ${firstName}` : ""}
      </p>

      {list.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="clipboard"
            title="No invitations yet"
            body="When you are invited to an assessment, it will appear here. Invitations are sent to this account's email address."
          />
        </div>
      ) : (
        <>
          <h1 className="mt-2 text-display text-foreground measure">
            {next ? (next.status === "in_progress" ? "Pick up where you left off." : "Your next step is ready.") : "Thank you. Here is where things stand."}
          </h1>

          {focus && <PathHorizon steps={pathFor(focus.status)} className="mt-8" />}

          {next && (
            <PrimaryCard className="mt-8 p-6 sm:p-8">
              <p className="text-mono-label text-muted">{next.status === "in_progress" ? "In progress" : "Up next"}</p>
              <h2 className="mt-2 text-headline text-foreground">{next.assessments?.title}</h2>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="clock" className="w-4 h-4" />
                  {next.assessments?.time_limit_minutes} minutes
                </span>
                <span>Answers save as you go</span>
                {next.due_at && <span className="font-semibold text-foreground">{dueLabel(next.due_at)}</span>}
              </p>
              <div className="mt-6">
                <ButtonLink href={`/candidate/assessments/${next.id}`} size="lg">
                  {next.status === "in_progress" ? "Continue assessment" : "Start assessment"}
                  <Icon name="arrowRight" className="w-4 h-4 ml-2" />
                </ButtonLink>
              </div>
            </PrimaryCard>
          )}

          <section aria-labelledby="mine-h" className="mt-12">
            <div className="flex items-baseline justify-between">
              <h2 id="mine-h" className="text-title-large text-foreground">
                Your assessments
              </h2>
              <Link href="/candidate/assessments" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-3 border-t border-line">
              {list.slice(0, 4).map((a) => (
                <ListRow
                  key={a.id}
                  href={a.status === "reviewed" ? `/candidate/results/${a.id}` : ["invited", "in_progress"].includes(a.status) ? `/candidate/assessments/${a.id}` : undefined}
                  trailing={<StatusBadge status={a.status} audience="candidate" />}
                >
                  <p className="truncate text-base font-semibold text-foreground">{a.assessments?.title}</p>
                  <p className="text-sm text-muted">
                    {a.assessments?.time_limit_minutes} min · invited {new Date(a.invited_at).toLocaleDateString()}
                  </p>
                </ListRow>
              ))}
            </div>
          </section>

          <section aria-labelledby="know-h" className="mt-12 rounded-card bg-surface-sunken p-6">
            <h2 id="know-h" className="text-title text-foreground">
              Know before you go
            </h2>
            <ul className="mt-3 space-y-2 text-base text-muted">
              <li>You can start whenever you have a quiet stretch of time before the due date.</li>
              <li>Answers save as you go, so a dropped connection will not cost you your progress.</li>
              <li>A person reviews every score. Specific examples beat general statements.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
