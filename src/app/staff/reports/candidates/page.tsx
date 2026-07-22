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
      "id, status, overall_score, invited_at, submitted_at, due_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email, department), assessments(title, vacancy_title)"
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
    due_at: string | null;
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

  const exportBase = `/staff/reports/candidates/export${qs({})}`;

  const exportRows: CandidateExportRow[] = list.map((r) => ({
    id: r.id,
    status: r.status,
    overall_score: r.overall_score,
    due_at: r.due_at,
    candidate: r.candidate ? { full_name: r.candidate.full_name, email: r.candidate.email } : null,
    assessments: r.assessments ? { title: r.assessments.title } : null,
  }));

  return (
    <div className="max-w-[1180px] mx-auto px-6 lg:px-10 py-10">
      <PageHeader title="Candidates" subtitle="Every assessment attempt across the organization, with Role Fit scores and review status." />

      <div className="flex items-center gap-1 mb-6 border-b border-line">
        <Link
          href="/staff/reports"
          className="px-3.5 py-2.5 text-sm font-semibold text-muted hover:text-foreground transition-colors"
        >
          Overview
        </Link>
        <span className="px-3.5 py-2.5 text-sm font-semibold text-foreground border-b-2 border-brand -mb-px">
          Candidates
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-5 mb-4 pb-4 border-b border-line">
        <div className="flex items-center gap-4">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/staff/reports/candidates${qs({ status: f.key })}`}
              className={`text-[13px] pb-1 border-b-2 transition-colors ${
                status === f.key ? "font-semibold text-foreground border-foreground" : "font-medium text-faint border-transparent hover:text-muted"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form className="flex-1 min-w-52 max-w-sm relative ml-auto" action="/staff/reports/candidates">
          {status && <input type="hidden" name="status" value={status} />}
          {department && <input type="hidden" name="department" value={department} />}
          {vacancy && <input type="hidden" name="vacancy" value={vacancy} />}
          <Icon name="search" className="w-3.5 h-3.5 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, or assessment"
            className="w-full bg-surface border border-line rounded-md pl-8 pr-3 py-1.5 text-[13px] placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 mb-8">
        <span className="text-[11.5px] text-faint">Export filter:</span>
        <form action="/staff/reports/candidates" className="flex items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {q && <input type="hidden" name="q" value={q} />}
          <select
            name="department"
            defaultValue={department}
            className="bg-surface border border-line rounded-md px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent"
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
            className="bg-surface border border-line rounded-md px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All vacancies / assessments</option>
            {vacancies.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <button className="bg-foreground text-background text-[12px] font-semibold px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity">
            Apply
          </button>
        </form>
      </div>

      <CandidateExportTable rows={exportRows} exportBase={exportBase} />
    </div>
  );
}
