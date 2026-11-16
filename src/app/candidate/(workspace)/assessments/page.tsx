import { extraMinutesFor } from "@/lib/extra-minutes";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, EmptyState, Icon, PageHeader, StatusBadge } from "@/components/ui";
import { nowMs } from "@/lib/time";
import { buttonClass } from "@/components/ui/Button";

type Row = {
  id: string;
  status: string;
  invited_at: string;
  due_at: string | null;
  assessments: { title: string; description: string; time_limit_minutes: number } | null;
};

// My tests (redesign plan B11): what is still to do first, then what is done,
// one status wording (the plain-language one), results one tap away.
export default async function CandidateAssessmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assessments } = await supabase
    .from("candidate_assessments")
    .select("id, status, invited_at, due_at, assessments(title, description, time_limit_minutes)")
    .eq("candidate_id", user!.id)
    .order("invited_at", { ascending: false });

  // Rows whose assessment isn't visible (a draft that was assigned before it was
  // published, or one the candidate can't see) come back with a null join; skip them.
  const list = ((assessments || []) as unknown as Row[]).filter((a) => a.assessments !== null);
  const extra = await extraMinutesFor(supabase, list.map((a) => a.id));
  const now = nowMs();
  const todo = list.filter((a) => ["invited", "in_progress"].includes(a.status));
  const done = list.filter((a) => !["invited", "in_progress"].includes(a.status));

  function Item({ a }: { a: Row }) {
    const pastDue = !!a.due_at && new Date(a.due_at).getTime() < now;
    // Only a test that has not been started can expire: once you have started,
    // you keep your full time.
    const expired = a.status === "invited" && pastDue;
    return (
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground">{a.assessments?.title}</h3>
            {a.assessments?.description && <p className="text-sm text-muted mt-1 max-w-xl">{a.assessments.description}</p>}
          </div>
          <StatusBadge status={a.status} audience="candidate" />
        </div>
        <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="timer" className="w-4 h-4" />
              {(a.assessments?.time_limit_minutes ?? 0) + (extra.get(a.id) ?? 0)} minutes
            </span>
            {a.due_at && ["invited", "in_progress"].includes(a.status) && (
              <span className={`inline-flex items-center gap-1.5 font-semibold ${expired ? "text-critical" : ""}`}>
                <Icon name="clock" className="w-4 h-4" />
                {expired ? `Deadline passed ${new Date(a.due_at).toLocaleDateString()}` : `Start by ${new Date(a.due_at).toLocaleDateString()}`}
              </span>
            )}
          </div>
          {expired ? (
            <span className="text-sm font-medium text-critical">Contact HR if you still need access</span>
          ) : ["invited", "in_progress"].includes(a.status) ? (
            <Link href={`/candidate/assessments/${a.id}`} className={buttonClass({ size: "md" })}>
              {a.status === "invited" ? "Start test" : "Continue"}
              <Icon name="arrowRight" className="w-4 h-4" />
            </Link>
          ) : a.status === "reviewed" ? (
            <Link href={`/candidate/results/${a.id}`} className={buttonClass({ size: "md", variant: "secondary" })}>
              <Icon name="award" className="w-4 h-4" />
              View result
            </Link>
          ) : (
            <span className="text-sm text-muted">A person is reviewing your answers</span>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="container-page max-w-4xl py-8 lg:py-12">
      <PageHeader title="My tests" subtitle="What you still need to do, and what you have finished." />

      {list.length === 0 && (
        <EmptyState title="No tests yet" body="When a recruiter invites you to a test, it appears here automatically." />
      )}

      {todo.length > 0 && (
        <section aria-labelledby="todo-h" className="mt-6">
          <h2 id="todo-h" className="text-title text-foreground mb-3">
            To do
          </h2>
          <div className="space-y-4">
            {todo.map((a) => (
              <Item key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section aria-labelledby="done-h" className="mt-10">
          <h2 id="done-h" className="text-title text-foreground mb-3">
            Done
          </h2>
          <div className="space-y-4">
            {done.map((a) => (
              <Item key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
