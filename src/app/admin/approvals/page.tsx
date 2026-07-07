import { createClient } from "@/lib/supabase/server";
import { Card, Icon, PageHeader, StatusBadge } from "@/components/ui";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { createApprovalRequest, decideApproval } from "../actions";

const TOASTS: ToastSpec[] = [
  { param: "ok", variant: "success" },
  { param: "error", variant: "error" },
];

export default async function AdminApprovalsPage() {
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("approval_requests")
    .select("*, requester:profiles!approval_requests_requested_by_fkey(full_name), decider:profiles!approval_requests_decided_by_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  const input = "w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <PageHeader
        title="Approval workflows"
        subtitle="Four-eyes control: user creation, role changes, and access requests are proposed here and executed only when an approver confirms. Pending requests older than 3 days should be escalated to the system administrator."
      />
      <ToastFromParams specs={TOASTS} />

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        <div className="space-y-3">
          {(requests || []).map((r) => {
            const requester = r.requester as unknown as { full_name: string } | null;
            const decider = r.decider as unknown as { full_name: string } | null;
            const p = r.payload as { email?: string; full_name?: string; role?: string; note?: string };
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <p className="font-bold text-foreground text-sm">
                    {r.request_type.replace(/_/g, " ")}
                    <span className="text-muted font-medium"> — {p.full_name || p.email} {p.role ? `as ${p.role.replace(/_/g, " ")}` : ""}</span>
                  </p>
                  <StatusBadge status={r.status === "pending" ? "in_progress" : r.status === "approved" ? "shortlist" : "reject"} />
                </div>
                <p className="text-xs text-muted mb-1.5">
                  Requested by <span className="font-semibold text-foreground">{requester?.full_name}</span> · {new Date(r.created_at).toLocaleString()}
                  {p.note ? ` — “${p.note}”` : ""}
                </p>
                {r.status !== "pending" ? (
                  <p className="text-xs text-faint">
                    {r.status} by {decider?.full_name} · {r.decided_at ? new Date(r.decided_at).toLocaleString() : ""} {r.comment ? `— “${r.comment}”` : ""}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2.5 mt-3">
                    <form action={decideApproval.bind(null, r.id, "approved")} className="flex items-center gap-2">
                      <input name="comment" placeholder="Comment (optional)" className="bg-surface border border-line rounded-xl px-3 py-2 text-xs w-44" aria-label="Approval comment" />
                      <ConfirmSubmitButton
                        compact
                        icon="check"
                        tone="accent"
                        confirmMessage="Approve this request and execute it immediately?"
                        className="inline-flex items-center gap-1.5 bg-accent text-white text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-accent-dark transition-colors"
                      >
                        Approve & execute
                      </ConfirmSubmitButton>
                    </form>
                    <form action={decideApproval.bind(null, r.id, "rejected")}>
                      <ConfirmSubmitButton
                        compact
                        icon="x"
                        tone="critical"
                        confirmMessage="Reject this request?"
                        className="inline-flex items-center gap-1.5 border border-line text-critical text-xs font-bold px-3.5 py-2 rounded-xl hover:border-critical transition-colors"
                      >
                        Reject
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                )}
              </Card>
            );
          })}
          {(!requests || requests.length === 0) && (
            <Card className="p-8 text-center text-sm text-faint">No approval requests yet.</Card>
          )}
        </div>

        <Card className="p-6 sticky top-6">
          <form action={createApprovalRequest} className="space-y-4">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <Icon name="plus" className="w-4 h-4 text-accent-dark" />
              New request
            </p>
            <select name="request_type" required className={input} aria-label="Request type">
              <option value="user_create">Create user</option>
              <option value="role_change">Change role</option>
              <option value="access_request">Access request</option>
            </select>
            <input name="full_name" placeholder="Full name" className={input} aria-label="Full name" />
            <input name="email" type="email" required placeholder="user@azerconnect.az" className={input} aria-label="Email" />
            <select name="role" className={input} aria-label="Role">
              {["candidate", "recruiter", "assessor", "hiring_manager", "decision_maker", "client_user", "hr_admin"].map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
              ))}
            </select>
            <textarea name="note" rows={2} placeholder="Business justification…" className={input} aria-label="Justification" />
            <ConfirmSubmitButton
              confirmMessage="Submit this request for approval?"
              tone="brand"
              className="w-full bg-brand text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-brand-light transition-colors"
            >
              Submit for approval
            </ConfirmSubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
