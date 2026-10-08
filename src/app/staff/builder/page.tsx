import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { createAssessment, deleteAssessment, assignAssessment, duplicateAssessment, setAssessmentArchived } from "./actions";
import { AssignAssessmentButton } from "@/components/AssignAssessmentButton";
import { Card, Icon, PageHeader, StatusBadge } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";
import { LEVELS, isLevelKey } from "@/lib/levels";

const TOAST_SPECS: ToastSpec[] = [
  { param: "error", variant: "error" },
  { param: "added", variant: "success" },
];

// AI generation can legitimately take 30-90+ seconds; give the underlying
// Server Action room to finish instead of racing an unnecessarily tight default.
export const maxDuration = 120;

const MODE_LABEL: Record<string, string> = {
  default_core: "Default · Core",
  default_leadership: "Default · Leadership",
  default_mix: "Default · Mix",
  generated: "Generated",
};

const ENGINE_LABEL: Record<string, string> = {
  claude: "Claude",
  fugu: "Sakana Fugu",
  kimi: "Kimi",
};

export default async function BuilderListPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; archived?: string; q?: string; position?: string }>;
}) {
  const { archived: archivedParam, q: queryParam, position: positionParam } = await searchParams;
  const showArchived = archivedParam === "1";
  const query = (queryParam || "").trim().toLowerCase();
  const positionFilter = positionParam || "";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id || "").maybeSingle();
  const isAdmin = profile?.role === "hr_admin" || profile?.role === "system_admin";

  const [{ data: assessments }, { data: positionOptions }, { data: assignableUsers }] = await Promise.all([
    supabase
      .from("assessments")
      .select(
        "id, title, description, status, time_limit_minutes, created_at, mode, engine, generated_at, purpose, content_language, target_level, vacancy_title, position_id, position:positions(title), assessment_sections(id), questions:assessment_sections(questions(id)), generator:profiles!assessments_generated_by_fkey(full_name)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("positions").select("id, title").is("archived_at", null).order("title"),
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("status", "active")
      .order("full_name"),
  ]);

  const listed = (assessments || []).filter((a) => (showArchived ? a.status === "archived" : a.status !== "archived"));
  const visible = listed.filter((a) => {
    if (positionFilter && a.position_id !== positionFilter) return false;
    if (query && !`${a.title} ${a.vacancy_title ?? ""} ${(a.position as unknown as { title: string } | null)?.title ?? ""}`.toLowerCase().includes(query)) return false;
    return true;
  });
  const archivedTotal = (assessments || []).filter((x) => x.status === "archived").length;

  const userOptions = (assignableUsers || []).map((u) => ({
    id: u.id,
    label: `${u.full_name} — ${u.email}`,
  }));

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader
        title="Assessment Builder"
        subtitle="Each assessment belongs to a position and a level. Draft it, review every question, then publish."
      />

      <ToastFromParams specs={TOAST_SPECS} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {(() => {
            const archivedCount = archivedTotal;
            if (archivedCount === 0 && !showArchived) return null;
            return (
              <div className="flex justify-end">
                <Link
                  href={showArchived ? "/staff/builder" : "/staff/builder?archived=1"}
                  className="text-xs font-semibold text-muted hover:text-foreground"
                >
                  {showArchived ? "← Back to active assessments" : `Show archived (${archivedCount})`}
                </Link>
              </div>
            );
          })()}
          <form method="get" className="flex flex-wrap gap-2">
            {showArchived && <input type="hidden" name="archived" value="1" />}
            <input
              name="q"
              defaultValue={queryParam || ""}
              placeholder="Search by title or position"
              aria-label="Search assessments"
              className="flex-1 min-w-[12rem] bg-surface border border-line rounded-xl px-3.5 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <select
              name="position"
              defaultValue={positionFilter}
              aria-label="Filter by position"
              className="bg-surface border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">All positions</option>
              {(positionOptions || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <button className="text-sm font-semibold border border-line rounded-xl px-4 py-2 hover:border-accent">Filter</button>
          </form>
          {visible.map((a) => {
            const generator = a.generator as unknown as { full_name: string } | null;
            return (
              <Card key={a.id} className={`relative p-5 group hover:border-accent transition-colors ${isAdmin ? "pr-12" : ""}`}>
                <Link href={`/staff/builder/${a.id}`} className="block">
                  <div className="flex items-center justify-between gap-4 mb-1.5">
                    <p className="font-bold text-foreground truncate">{a.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.mode !== "manual" && (
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-accent-soft text-accent-dark ring-1 ring-inset ring-accent/20">
                          {MODE_LABEL[a.mode] || a.mode}
                        </span>
                      )}
                      <StatusBadge status={a.status} />
                    </div>
                  </div>
                  {a.description && <p className="text-xs text-muted line-clamp-1 mb-2.5">{a.description}</p>}
                  <p className="text-xs text-muted flex items-center gap-x-4 gap-y-1 flex-wrap mb-1.5">
                    <span className="font-medium text-foreground">{(a.position as unknown as { title: string } | null)?.title ?? a.vacancy_title ?? "No position"}</span>
                    {isLevelKey(a.target_level) && <span>{LEVELS[a.target_level].label}</span>}
                    <span className="capitalize">{a.purpose ?? "hiring"}</span>
                    <span>{a.content_language === "az" ? "Azərbaycan dili" : a.content_language === "ru" ? "Русский" : "English"}</span>
                    <span>
                      {(a.questions as unknown as { questions: unknown[] }[]).reduce((n, sec) => n + (sec.questions?.length ?? 0), 0)} questions
                    </span>
                  </p>
                  <p className="text-xs text-muted flex items-center gap-4 flex-wrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="layers" className="w-3.5 h-3.5" />
                      {(a.assessment_sections || []).length} section{(a.assessment_sections || []).length === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="timer" className="w-3.5 h-3.5" />
                      {a.time_limit_minutes} min
                    </span>
                    <span>created {new Date(a.created_at).toLocaleDateString()}</span>
                    {a.mode !== "manual" && generator && (
                      <span className="inline-flex items-center gap-1.5 text-accent-dark">
                        <Icon name="wand" className="w-3.5 h-3.5" />
                        Generated by {generator.full_name} · {new Date(a.generated_at!).toLocaleDateString()} · via{" "}
                        {ENGINE_LABEL[a.engine || ""] || a.engine}
                      </span>
                    )}
                  </p>
                </Link>
                <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center gap-x-4 gap-y-2">
                  {a.status !== "archived" && (
                    <AssignAssessmentButton action={assignAssessment.bind(null, a.id)} users={userOptions} />
                  )}
                  <form action={duplicateAssessment.bind(null, a.id)}>
                    <button className="text-2xs font-semibold text-accent-dark hover:underline">Duplicate</button>
                  </form>
                  <form action={setAssessmentArchived.bind(null, a.id, a.status !== "archived")}>
                    <button className="text-2xs font-semibold text-muted hover:text-foreground hover:underline">
                      {a.status === "archived" ? "Restore" : "Archive"}
                    </button>
                  </form>
                  {a.status === "draft" && (
                    <span className="text-2xs text-muted ml-auto">Still a draft — assigned people won&apos;t see it until you publish.</span>
                  )}
                </div>
                {isAdmin && (
                  <form action={deleteAssessment.bind(null, a.id)} className="absolute top-4 right-4">
                    <ConfirmSubmitButton
                      confirmMessage={`Delete "${a.title}"? This removes all its sections, questions, invitations, and candidate results. This can't be undone.`}
                      icon="trash"
                      label={`Delete "${a.title}"`}
                      className="p-1.5 rounded-lg text-muted hover:text-critical hover:bg-red-50 transition-colors"
                      compact
                    />
                  </form>
                )}
              </Card>
            );
          })}
          {visible.length === 0 && listed.length > 0 && <p className="text-sm text-muted">No assessments match that search.</p>}
          {(!assessments || assessments.length === 0) && (
            <Card className="p-8 text-center">
              <p className="font-semibold text-foreground">No assessments yet</p>
              <p className="text-sm text-muted mt-1">Start one with the New assessment card on the right.</p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <p className="font-bold text-foreground text-sm flex items-center gap-2">
              <Icon name="plus" className="w-4 h-4 text-accent-dark" />
              New assessment
            </p>
            <p className="text-xs text-muted">
              Start from a position and a level. Add the job description or notes if you have them, and the AI drafts questions you review before anything is published.
            </p>
            <Link
              href="/staff/builder/new"
              className="block text-center bg-brand-deep text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-brand transition-colors"
            >
              Start a new assessment
            </Link>
            <Link href="/staff/builder/positions" className="block text-center border border-line rounded-xl py-2.5 text-sm font-semibold hover:border-accent">
              Manage positions
            </Link>
          </Card>

          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-foreground">Create a blank draft instead</summary>
            <Card className="p-6 mt-3">
              <form action={createAssessment} className="space-y-4">
                <input
                  name="title"
                  required
                  placeholder="e.g. Graduate Trainee — Core Assessment"
                  className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <textarea
                  name="description"
                  placeholder="What this assessment measures and who it's for…"
                  rows={3}
                  className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
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
                <button className="w-full border border-line rounded-xl py-2.5 text-sm font-semibold hover:border-accent">Create blank draft</button>
                <p className="text-2xs text-muted">Drafts stay private until you publish. You&apos;ll add sections and questions by hand.</p>
              </form>
            </Card>
          </details>
        </div>
      </div>
    </div>
  );
}
