import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Icon, Avatar } from "@/components/ui";
import { addCandidate, addDecisionMaker, resendInvite } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  system_admin: "Super Admin",
  hr_admin: "Admin",
  recruiter: "Recruiter",
  hiring_manager: "Hiring Manager",
  decision_maker: "Decision Maker",
  candidate: "Candidate",
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; added?: string }>;
}) {
  const { error, added } = await searchParams;
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, department, created_at")
    .order("created_at", { ascending: false });

  const staffRows = (profiles || []).filter((p) => p.role !== "candidate");
  const candidateRows = (profiles || []).filter((p) => p.role === "candidate");

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader
        title="People & Access"
        subtitle="Add candidates and decision makers — accounts are invite-only, so this is the only way in. Signup is disabled for everyone else."
      />

      {error && (
        <div className="mb-6 text-sm text-critical bg-red-50 border border-red-200 rounded-xl px-4 py-3">{decodeURIComponent(error)}</div>
      )}
      {added && (
        <div className="mb-6 text-sm text-accent-dark bg-accent-soft border border-accent/20 rounded-xl px-4 py-3">
          {decodeURIComponent(added)} was added and invited by email.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5 mb-8">
        <Card className="p-6">
          <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
            <Icon name="users" className="w-4 h-4 text-brand" />
            Add a candidate
          </p>
          <p className="text-xs text-muted mb-4">Creates the account and emails an invite link to set a password.</p>
          <form action={addCandidate} className="space-y-3">
            <input name="full_name" required placeholder="Full name" className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            <input name="email" type="email" required placeholder="Email address" className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            <input name="department" placeholder="Department / structure (optional)" className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            <button className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-light transition-colors">
              <Icon name="plus" className="w-4 h-4" />
              Add & invite candidate
            </button>
          </form>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
            <Icon name="shield" className="w-4 h-4 text-brand" />
            Add a decision maker
          </p>
          <p className="text-xs text-muted mb-4">
            External or internal stakeholders who can review specific candidates and submit a decision. Assign them to
            a candidate from that candidate&apos;s review page.
          </p>
          <form action={addDecisionMaker} className="space-y-3">
            <input name="full_name" required placeholder="Full name" className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            <input name="email" type="email" required placeholder="Email address" className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            <button className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-light transition-colors">
              <Icon name="plus" className="w-4 h-4" />
              Add & invite decision maker
            </button>
          </form>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden mb-8">
        <p className="text-sm font-bold text-foreground px-6 pt-5 pb-3">Team & decision makers</p>
        <table className="w-full text-sm">
          <thead className="text-faint text-[11px] uppercase tracking-wider border-y border-line">
            <tr>
              <th className="text-left px-6 py-3 font-semibold">Name</th>
              <th className="text-left px-6 py-3 font-semibold">Role</th>
              <th className="text-left px-6 py-3 font-semibold">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {staffRows.map((p) => (
              <tr key={p.id}>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.full_name} className="w-8 h-8 text-[11px]" />
                    <div>
                      <p className="font-semibold text-foreground">{p.full_name}</p>
                      <p className="text-xs text-muted">{p.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3 text-muted">{ROLE_LABEL[p.role] || p.role}</td>
                <td className="px-6 py-3 text-faint text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-0 overflow-hidden">
        <p className="text-sm font-bold text-foreground px-6 pt-5 pb-3">Candidates ({candidateRows.length})</p>
        <table className="w-full text-sm">
          <thead className="text-faint text-[11px] uppercase tracking-wider border-y border-line">
            <tr>
              <th className="text-left px-6 py-3 font-semibold">Name</th>
              <th className="text-left px-6 py-3 font-semibold">Department</th>
              <th className="text-left px-6 py-3 font-semibold">Added</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {candidateRows.map((p) => (
              <tr key={p.id}>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.full_name} className="w-8 h-8 text-[11px]" />
                    <div>
                      <p className="font-semibold text-foreground">{p.full_name}</p>
                      <p className="text-xs text-muted">{p.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3 text-muted">{p.department || "—"}</td>
                <td className="px-6 py-3 text-faint text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-3 text-right">
                  <form action={resendInvite.bind(null, p.email)}>
                    <button className="text-accent-dark text-xs font-semibold hover:underline">Resend invite</button>
                  </form>
                </td>
              </tr>
            ))}
            {candidateRows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-faint text-sm">
                  No candidates yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
