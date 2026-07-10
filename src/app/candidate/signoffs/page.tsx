import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, EmptyState, Icon, PageHeader, StatusBadge } from "@/components/ui";
import { decideManagerSignoff } from "./actions";

type Row = {
  id: string;
  status: string;
  comment: string | null;
  requested_at: string;
  decided_at: string | null;
  candidate_assessment_id: string;
};

export default async function SignoffsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: signoffs } = await supabase
    .from("promotion_signoffs")
    .select("id, status, comment, requested_at, decided_at, candidate_assessment_id")
    .eq("manager_id", user.id)
    .order("requested_at", { ascending: false });

  const rows = (signoffs || []) as Row[];

  const caIds = rows.map((r) => r.candidate_assessment_id);
  const { data: cas } = caIds.length
    ? await supabase
        .from("candidate_assessments")
        .select("id, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name), assessments(title)")
        .in("id", caIds)
    : { data: [] };

  const caMeta = new Map(
    (cas || []).map((c) => [
      c.id as string,
      {
        candidateName: (c.candidate as unknown as { full_name: string } | null)?.full_name || "This employee",
        assessmentTitle: (c.assessments as unknown as { title: string } | null)?.title || "an assessment",
      },
    ])
  );

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <PageHeader
        title="Sign-off requests"
        subtitle="Promotion reviews where HR has asked for your input as the employee's manager. Optional — not a blocking approval."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon="checkCircle"
          title="No sign-off requests"
          body="When HR requests your input on a direct report's promotion review, it will show up here."
        />
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-4 mb-8">
              <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Awaiting your response</p>
              {pending.map((r) => {
                const meta = caMeta.get(r.candidate_assessment_id);
                const decideWithId = decideManagerSignoff.bind(null, r.id);
                return (
                  <Card key={r.id} className="p-6">
                    <p className="text-sm font-semibold text-foreground mb-1">
                      {meta?.candidateName} — <span className="font-normal text-muted">{meta?.assessmentTitle}</span>
                    </p>
                    <p className="text-xs text-faint mb-4">Requested {new Date(r.requested_at).toLocaleString()}</p>
                    <form className="space-y-3">
                      <textarea
                        name="comment"
                        rows={3}
                        placeholder="Optional notes to accompany your response…"
                        className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <div className="flex gap-2.5">
                        <button
                          formAction={async (formData) => {
                            "use server";
                            await decideWithId("approved", formData);
                          }}
                          className="inline-flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-light transition-colors"
                        >
                          <Icon name="check" className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          formAction={async (formData) => {
                            "use server";
                            await decideWithId("declined", formData);
                          }}
                          className="inline-flex items-center gap-2 border border-line text-sm font-semibold px-4 py-2.5 rounded-xl text-foreground hover:border-red-400 hover:text-red-600 transition-colors"
                        >
                          <Icon name="x" className="w-4 h-4" />
                          Decline
                        </button>
                      </div>
                    </form>
                  </Card>
                );
              })}
            </div>
          )}

          {decided.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Previously decided</p>
              {decided.map((r) => {
                const meta = caMeta.get(r.candidate_assessment_id);
                return (
                  <Card key={r.id} className="p-5 flex items-start gap-3">
                    <StatusBadge status={r.status === "approved" ? "shortlist" : "reject"} />
                    <div className="text-sm text-muted min-w-0">
                      <p>
                        <span className="font-semibold text-foreground">{meta?.candidateName}</span> —{" "}
                        {meta?.assessmentTitle}
                      </p>
                      {r.comment && <p className="mt-1 italic">&ldquo;{r.comment}&rdquo;</p>}
                      <p className="text-faint text-xs mt-1">
                        {r.decided_at ? new Date(r.decided_at).toLocaleString() : ""}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
