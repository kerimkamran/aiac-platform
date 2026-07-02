import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { createAssessment } from "./actions";
import { Card, Icon, PageHeader, StatusBadge } from "@/components/ui";

export default async function BuilderListPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, title, description, status, time_limit_minutes, created_at, assessment_sections(id)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader
        title="Assessment Builder"
        subtitle="Compose assessments from the governed competency library, publish them, and invite candidates."
      />

      {error && (
        <p className="text-sm text-critical bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">{error}</p>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {(assessments || []).map((a) => (
            <Link key={a.id} href={`/staff/builder/${a.id}`} className="block group">
              <Card className="p-5 group-hover:border-accent transition-colors">
                <div className="flex items-center justify-between gap-4 mb-1.5">
                  <p className="font-bold text-foreground truncate">{a.title}</p>
                  <StatusBadge status={a.status} />
                </div>
                {a.description && <p className="text-[13px] text-muted line-clamp-1 mb-2.5">{a.description}</p>}
                <p className="text-xs text-faint flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="layers" className="w-3.5 h-3.5" />
                    {(a.assessment_sections || []).length} section{(a.assessment_sections || []).length === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="timer" className="w-3.5 h-3.5" />
                    {a.time_limit_minutes} min
                  </span>
                  <span>created {new Date(a.created_at).toLocaleDateString()}</span>
                </p>
              </Card>
            </Link>
          ))}
          {(!assessments || assessments.length === 0) && (
            <Card className="p-8 text-center">
              <p className="font-semibold text-foreground">No assessments yet</p>
              <p className="text-sm text-muted mt-1">Create your first one with the panel on the right.</p>
            </Card>
          )}
        </div>

        <div>
          <Card className="p-6 sticky top-6">
            <form action={createAssessment} className="space-y-4">
              <p className="font-bold text-foreground text-sm flex items-center gap-2">
                <Icon name="plus" className="w-4 h-4 text-accent-dark" />
                New assessment
              </p>
              <input
                name="title"
                required
                placeholder="e.g. Graduate Trainee — Core Assessment"
                className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <textarea
                name="description"
                placeholder="What this assessment measures and who it's for…"
                rows={3}
                className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <div>
                <label className="text-xs font-semibold text-muted block mb-1.5">Time limit (minutes)</label>
                <input
                  name="time_limit_minutes"
                  type="number"
                  min={5}
                  defaultValue={60}
                  className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <button className="w-full bg-brand text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-brand-light transition-colors">
                Create draft
              </button>
              <p className="text-[11px] text-faint">
                Drafts stay private until you publish. You&apos;ll add sections and questions next.
              </p>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
