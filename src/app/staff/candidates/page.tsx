import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Avatar, Card, Icon, PageHeader, ScoreBadge, StatusBadge } from "@/components/ui";

const FILTERS = [
  { key: "", label: "All" },
  { key: "invited", label: "Invited" },
  { key: "in_progress", label: "In progress" },
  { key: "scored", label: "Awaiting review" },
  { key: "reviewed", label: "Reviewed" },
];

export default async function StaffCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = "", q = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("candidate_assessments")
    .select(
      "id, status, overall_score, invited_at, submitted_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email), assessments(title)"
    )
    .order("invited_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data: rows } = await query;

  let list = (rows || []) as unknown as {
    id: string;
    status: string;
    overall_score: number | null;
    invited_at: string;
    submitted_at: string | null;
    candidate: { full_name: string; email: string } | null;
    assessments: { title: string } | null;
  }[];

  if (q) {
    const needle = q.toLowerCase();
    list = list.filter(
      (r) =>
        r.candidate?.full_name?.toLowerCase().includes(needle) ||
        r.candidate?.email?.toLowerCase().includes(needle) ||
        r.assessments?.title?.toLowerCase().includes(needle)
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader title="Candidates" subtitle="Every assessment attempt across the organization, with Role Fit scores and review status." />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5 bg-surface border border-line rounded-xl p-1">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key ? `/staff/candidates?status=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}` : `/staff/candidates${q ? `?q=${encodeURIComponent(q)}` : ""}`}
              className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                status === f.key ? "bg-brand text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form className="flex-1 min-w-52 max-w-sm relative" action="/staff/candidates">
          {status && <input type="hidden" name="status" value={status} />}
          <Icon name="search" className="w-4 h-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, or assessment…"
            className="w-full bg-surface border border-line rounded-xl pl-10 pr-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </form>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-faint text-[11px] uppercase tracking-wider border-b border-line">
            <tr>
              <th className="text-left px-5 py-3.5 font-semibold">Candidate</th>
              <th className="text-left px-5 py-3.5 font-semibold">Assessment</th>
              <th className="text-left px-5 py-3.5 font-semibold">Status</th>
              <th className="text-left px-5 py-3.5 font-semibold">Role Fit</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-background/70 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.candidate?.full_name || "?"} />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{r.candidate?.full_name}</p>
                      <p className="text-xs text-muted truncate">{r.candidate?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-muted">{r.assessments?.title}</td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-5 py-3.5">
                  {r.overall_score !== null ? <ScoreBadge score={Math.round(r.overall_score)} /> : <span className="text-faint">—</span>}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link
                    href={`/staff/candidates/${r.id}`}
                    className="inline-flex items-center gap-1.5 text-accent-dark font-semibold whitespace-nowrap hover:underline"
                  >
                    Review
                    <Icon name="arrowRight" className="w-3.5 h-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-faint text-sm">
                  No candidates match — try clearing the filters, or invite candidates from the Assessment Builder.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
