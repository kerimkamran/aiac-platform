import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Icon, PageHeader } from "@/components/ui";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";
import { LEVELS, isLevelKey } from "@/lib/levels";

const TOAST_SPECS: ToastSpec[] = [
  { param: "error", variant: "error" },
  { param: "added", variant: "success" },
];

export default async function PositionsListPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; q?: string }>;
}) {
  const { archived: archivedParam, q: queryParam } = await searchParams;
  const showArchived = archivedParam === "1";
  const query = (queryParam || "").trim().toLowerCase();
  const supabase = await createClient();

  const [{ data: positions }, { data: files }, { data: runs }] = await Promise.all([
    supabase
      .from("positions")
      .select("id, title, department, default_level, job_description, archived_at, updated_at")
      .order("title"),
    supabase.from("position_files").select("position_id"),
    supabase.from("assessments").select("position_id").not("position_id", "is", null),
  ]);

  const fileCount = new Map<string, number>();
  for (const f of files || []) fileCount.set(f.position_id, (fileCount.get(f.position_id) || 0) + 1);
  const draftCount = new Map<string, number>();
  for (const r of runs || []) if (r.position_id) draftCount.set(r.position_id, (draftCount.get(r.position_id) || 0) + 1);

  const all = positions || [];
  const archivedCount = all.filter((p) => p.archived_at).length;
  const visible = all.filter((p) => (showArchived ? !!p.archived_at : !p.archived_at)).filter((p) => !query || p.title.toLowerCase().includes(query));

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <PageHeader title="Positions" subtitle="The roles you assess. Each keeps its job description, notes and reference files for the next assessment." >
        <Link
          href="/staff/builder/positions/new"
          className="inline-flex items-center gap-2 bg-brand-deep text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand transition-colors"
        >
          <Icon name="plus" className="w-4 h-4" />
          New position
        </Link>
      </PageHeader>
      <ToastFromParams specs={TOAST_SPECS} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <form method="get" className="flex-1 min-w-[12rem] max-w-md">
          {showArchived && <input type="hidden" name="archived" value="1" />}
          <input
            name="q"
            defaultValue={queryParam || ""}
            placeholder="Search positions"
            aria-label="Search positions"
            className="w-full bg-surface border border-line rounded-xl px-3.5 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </form>
        {(archivedCount > 0 || showArchived) && (
          <Link href={showArchived ? "/staff/builder/positions" : "/staff/builder/positions?archived=1"} className="text-xs font-semibold text-muted hover:text-foreground">
            {showArchived ? "← Back to active positions" : `Show archived (${archivedCount})`}
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {visible.map((p) => (
          <Link key={p.id} href={`/staff/builder/positions/${p.id}`} className="block">
            <Card interactive className="p-5">
              <div className="flex items-center justify-between gap-4">
                <p className="font-bold text-foreground truncate">{p.title}</p>
                <span className="text-2xs text-muted shrink-0">{isLevelKey(p.default_level) ? LEVELS[p.default_level].label : ""}</span>
              </div>
              <p className="text-xs text-muted mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                <span>{p.department || "No department"}</span>
                <span>{p.job_description ? "Job description on file" : "No job description yet"}</span>
                <span>
                  {fileCount.get(p.id) || 0} reference file{(fileCount.get(p.id) || 0) === 1 ? "" : "s"}
                </span>
                <span>
                  {draftCount.get(p.id) || 0} assessment{(draftCount.get(p.id) || 0) === 1 ? "" : "s"}
                </span>
              </p>
            </Card>
          </Link>
        ))}
        {visible.length === 0 && (
          <Card className="p-8 text-center">
            <p className="font-semibold text-foreground">{showArchived ? "No archived positions" : "No positions yet"}</p>
            <p className="text-sm text-muted mt-1">
              {showArchived ? "Archived positions appear here." : "Create one, or type a new position when you start an assessment."}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
