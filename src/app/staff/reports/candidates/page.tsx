import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Icon, PageHeader } from "@/components/ui";
import { CandidateExportTable, type CandidateExportRow } from "@/components/CandidateExportTable";
import { Callout } from "@/components/ui/Callout";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";
import { getSessionProfile } from "@/lib/authz";
import { buildCandidateAssessmentQuery } from "@/lib/candidate-filters";
import { DataTablePagination } from "@/components/DataTable";

const TOAST_SPECS: ToastSpec[] = [
  { param: "error", variant: "error" },
  { param: "added", variant: "success" },
];

const FILTERS = [
  { key: "", label: "All" },
  { key: "invited", label: "Invited" },
  { key: "in_progress", label: "In progress" },
  { key: "submitted", label: "Submitted" },
  { key: "scored", label: "To review" },
  { key: "reviewed", label: "Reviewed" },
];

// STF-B-16: the list loaded every matching row with no paging, which both
// silently truncated at the API's row-limit cap on a large org and made
// "Export selected" build a URL with one id per row. Same server-side
// filtering pattern as /admin/users and /staff/people (ilike + range).
const PAGE_SIZE = 25;
const LIST_SELECT =
  "id, status, overall_score, invited_at, submitted_at, due_at, candidate:__CANDIDATE_REL__(full_name, email, department, last_login_at), assessments:__ASSESSMENT_REL__(title, vacancy_title)";

export default async function StaffCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; department?: string; vacancy?: string; page?: string }>;
}) {
  const { status = "", q = "", department = "", vacancy = "", page: pageParam = "1" } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();
  const me = await getSessionProfile();
  const canCopyLink = me?.role === "hr_admin" || me?.role === "system_admin";

  type Row = {
    id: string;
    status: string;
    overall_score: number | null;
    invited_at: string;
    submitted_at: string | null;
    due_at: string | null;
    candidate: { full_name: string; email: string; department: string | null; last_login_at: string | null } | null;
    assessments: { title: string; vacancy_title: string | null } | null;
  };

  const [{ data: rows, count, error: loadError }, { data: optionRows }] = await Promise.all([
    buildCandidateAssessmentQuery(supabase, LIST_SELECT, { status, q, department, vacancy }, { count: "exact" })
      .order("invited_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    // The filter lists offer every value in the set being narrowed, not only
    // what is left after narrowing (STF-B-13) -- so this one ignores
    // q/department/vacancy and only respects the status tab, and it's a
    // separate, narrow-column query rather than reusing the paginated result.
    buildCandidateAssessmentQuery(
      supabase,
      "candidate:__CANDIDATE_REL__(department), assessments:__ASSESSMENT_REL__(title, vacancy_title)",
      { status }
    ),
  ]);

  const list = (rows || []) as unknown as Row[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const optionList = (optionRows || []) as unknown as {
    candidate: { department: string | null } | null;
    assessments: { title: string; vacancy_title: string | null } | null;
  }[];
  const departments = Array.from(new Set(optionList.map((r) => r.candidate?.department).filter(Boolean))) as string[];
  const vacancies = Array.from(
    new Set(optionList.map((r) => r.assessments?.vacancy_title || r.assessments?.title).filter(Boolean))
  ) as string[];

  const qs = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ status, q, department, vacancy, page: String(page), ...overrides });
    for (const [k, v] of Array.from(params.entries())) if (!v || v === "1") params.delete(k);
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  const exportBase = `/staff/reports/candidates/export${qs({ page: "" })}`;
  const pageHref = (p: number) => `/staff/reports/candidates${qs({ page: String(p) })}`;

  // Answers still waiting for a person to confirm them, counted per attempt.
  const flagCount = new Map<string, number>();
  if (list.length > 0) {
    const { data: flagged } = await supabase
      .from("candidate_responses")
      .select("candidate_assessment_id")
      .eq("needs_review", true)
      .in("candidate_assessment_id", list.map((r) => r.id));
    for (const f of (flagged || []) as { candidate_assessment_id: string }[]) {
      flagCount.set(f.candidate_assessment_id, (flagCount.get(f.candidate_assessment_id) ?? 0) + 1);
    }
  }

  const exportRows: CandidateExportRow[] = list.map((r) => ({
    id: r.id,
    status: r.status,
    overall_score: r.overall_score,
    due_at: r.due_at,
    submitted_at: r.submitted_at,
    flags: flagCount.get(r.id) ?? 0,
    candidate: r.candidate ? { full_name: r.candidate.full_name, email: r.candidate.email } : null,
    lastLoginAt: r.candidate?.last_login_at ?? null,
    assessments: r.assessments ? { title: r.assessments.title } : null,
  }));

  return (
    <div className="max-w-[1180px] mx-auto px-6 lg:px-10 py-10">
      <PageHeader title="Candidates" subtitle="Everyone who has been invited to a test, with their status, score and what is waiting for a person." />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-5 mb-4 pb-4 border-b border-line">
        <div className="flex items-center gap-4">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/staff/reports/candidates${qs({ status: f.key, page: "1" })}`}
              aria-current={status === f.key ? "page" : undefined}
              className={`text-sm min-h-11 inline-flex items-center border-b-2 transition-colors ${
                status === f.key ? "font-semibold text-foreground border-foreground" : "font-medium text-muted border-transparent hover:text-foreground hover:border-line"
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
          <Icon name="search" className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email or test"
            className="w-full bg-surface border border-line rounded-md pl-8 pr-3 py-1.5 text-xs placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 mb-8">
        <span className="text-sm text-muted">Filter by:</span>
        <form action="/staff/reports/candidates" className="flex items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {q && <input type="hidden" name="q" value={q} />}
          <select
            name="department"
            defaultValue={department}
            className="bg-surface border border-line rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
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
            className="bg-surface border border-line rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All vacancies / assessments</option>
            {vacancies.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <button className="bg-foreground text-background text-xs font-semibold px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity">
            Apply
          </button>
        </form>
      </div>

      <ToastFromParams specs={TOAST_SPECS} />
      {loadError ? (
        <Callout tone="critical" role="alert" className="mb-5">
          The list could not be loaded, so what you see may be incomplete. Refresh the page; if it keeps happening, tell your administrator.
        </Callout>
      ) : null}
      <CandidateExportTable rows={exportRows} exportBase={exportBase} canCopyLink={canCopyLink} />
      {totalPages > 1 && <DataTablePagination pageNum={page} totalPages={totalPages} total={total} makeHref={pageHref} />}
    </div>
  );
}
