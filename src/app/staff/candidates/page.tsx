import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Icon, PageHeader } from "@/components/ui";
import { CandidateExportTable, type CandidateExportRow } from "@/components/CandidateExportTable";

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
  searchParams: Promise<{ status?: string; q?: string; department?: string; vacancy?: string }>;
}) {
  const { status = "", q = "", department = "", vacancy = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("candidate_assessments")
    .select(
      "id, status, overall_score, invited_at, submitted_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email, department), assessments(title, vacancy_title)"
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
    candidate: { full_name: string; email: string; department: string | null } | null;
    assessments: { title: string; vacancy_title: string | null } | null;
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
  if (department) list = list.filter((r) => r.candidate?.department === department);
  if (vacancy) list = list.filter((r) => (r.assessments?.vacancy_title || r.assessments?.title) === vacancy);

  const departments = Array.from(new Set(list.map((r) => r.candidate?.department).filter(Boolean))) as string[];
  const vacancies = Array.from(
    new Set(list.map((r) => r.assessments?.vacancy_title || r.assessments?.title).filter(Boolean))
  ) as string[];

  const qs = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ status, q, department, vacancy, ...overrides });
    for (const [k, v] of Array.from(params.entries())) if (!v) params.delete(k);
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  const exportBase = `/staff/candidates/export${qs({})}`;

  const exportRows: CandidateExportRow[] = list.map((r) => ({
    id: r.id,
    status: r.status,
    overall_score: r.overall_score,
    candidate: r.candidate ? { full_name: r.candidate.full_name, email: r.candidate.email } : null,
    assessments: r.assessments ? { title: r.assessments.title } : null,
  }));

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader title="Candidates" subtitle="Every assessment attempt across the organization, with Role Fit scores and review status." />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1.5 bg-surface border border-line rounded-xl p-1">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/staff/candidates${qs({ status: f.key })}`}
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
          {department && <input type="hidden" name="department" value={department} />}
          {vacancy && <input type="hidden" name="vacancy" value={vacancy} />}
          <Icon name="search" className="w-4 h-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, or assessment…"
            className="w-full bg-surface border border-line rounded-xl pl-10 pr-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="flex items-center gap-1.5 text-xs text-faint font-semibold">
          <Icon name="filter" className="w-3.5 h-3.5" />
          Filter for export
        </div>
        <form action="/staff/candidates" className="flex items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {q && <input type="hidden" name="q" value={q} />}
          <select
            name="department"
            defaultValue={department}
            className="bg-surface border border-line rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">All departments / structures</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            name="vacancy"
            defaultValue={vacancy}
            className="bg-surface border border-line rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">All vacancies / assessments</option>
            {vacancies.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <button className="bg-foreground text-white text-xs font-semibold px-3.5 py-2 rounded-xl hover:opacity-90 transition-opacity">
            Apply
          </button>
        </form>
      </div>

      <CandidateExportTable rows={exportRows} exportBase={exportBase} />
    </div>
  );
}
