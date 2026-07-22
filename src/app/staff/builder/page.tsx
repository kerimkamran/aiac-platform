import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { createAssessment, deleteAssessment, assignAssessment, duplicateAssessment, setAssessmentArchived } from "./actions";
import { AssignAssessmentButton } from "@/components/AssignAssessmentButton";
import { Card, Icon, PageHeader, StatusBadge } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { CreateAssessmentPanel } from "./CreateAssessmentPanel";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";

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
  searchParams: Promise<{ error?: string; archived?: string }>;
}) {
  const { archived: archivedParam } = await searchParams;
  const showArchived = archivedParam === "1";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id || "").maybeSingle();
  const isAdmin = profile?.role === "hr_admin" || profile?.role === "system_admin";

  const [{ data: assessments }, { data: competencies }, { data: engines }, { data: assignableUsers }] = await Promise.all([
    supabase
      .from("assessments")
      .select(
        "id, title, description, status, time_limit_minutes, created_at, mode, engine, generated_at, assessment_sections(id), generator:profiles!assessments_generated_by_fkey(full_name)"
      )
      .order("created_at", { ascending: false }),
    isAdmin
      ? supabase.from("competencies").select("id, name, category").order("category").order("name")
      : Promise.resolve({ data: [] }),
    isAdmin ? supabase.from("generation_engines").select("key, display_name, enabled, api_key_secret_id") : Promise.resolve({ data: [] }),
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("status", "active")
      .order("full_name"),
  ]);

  const userOptions = (assignableUsers || []).map((u) => ({
    id: u.id,
    label: `${u.full_name} — ${u.email}`,
  }));

  const compGroups = ["Core", "Leadership", "Functional"]
    .map((cat) => ({ cat, items: (competencies || []).filter((c) => c.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader
        title="Assessment Builder"
        subtitle="Compose assessments from the governed competency library or generate scenarios from the Case Library, then publish."
      />

      <ToastFromParams specs={TOAST_SPECS} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {(() => {
            const archivedCount = (assessments || []).filter((x) => x.status === "archived").length;
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
          {(assessments || []).filter((a) => (showArchived ? a.status === "archived" : a.status !== "archived")).map((a) => {
            const generator = a.generator as unknown as { full_name: string } | null;
            return (
              <Card key={a.id} className={`relative p-5 group hover:border-accent transition-colors ${isAdmin ? "pr-12" : ""}`}>
                <Link href={`/staff/builder/${a.id}`} className="block">
                  <div className="flex items-center justify-between gap-4 mb-1.5">
                    <p className="font-bold text-foreground truncate">{a.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.mode !== "manual" && (
                        <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-accent-soft text-accent-dark ring-1 ring-inset ring-accent/20">
                          {MODE_LABEL[a.mode] || a.mode}
                        </span>
                      )}
                      <StatusBadge status={a.status} />
                    </div>
                  </div>
                  {a.description && <p className="text-[13px] text-muted line-clamp-1 mb-2.5">{a.description}</p>}
                  <p className="text-xs text-faint flex items-center gap-4 flex-wrap">
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
                    <button className="text-[11px] font-semibold text-accent-dark hover:underline">Duplicate</button>
                  </form>
                  <form action={setAssessmentArchived.bind(null, a.id, a.status !== "archived")}>
                    <button className="text-[11px] font-semibold text-faint hover:text-foreground hover:underline">
                      {a.status === "archived" ? "Restore" : "Archive"}
                    </button>
                  </form>
                  {a.status === "draft" && (
                    <span className="text-[11px] text-faint ml-auto">Still a draft — assigned people won&apos;t see it until you publish.</span>
                  )}
                </div>
                {isAdmin && (
                  <form action={deleteAssessment.bind(null, a.id)} className="absolute top-4 right-4">
                    <ConfirmSubmitButton
                      confirmMessage={`Delete "${a.title}"? This removes all its sections, questions, invitations, and candidate results. This can't be undone.`}
                      icon="trash"
                      className="p-1.5 rounded-lg text-faint hover:text-critical hover:bg-red-50 transition-colors"
                      compact
                    />
                  </form>
                )}
              </Card>
            );
          })}
          {(!assessments || assessments.length === 0) && (
            <Card className="p-8 text-center">
              <p className="font-semibold text-foreground">No assessments yet</p>
              <p className="text-sm text-muted mt-1">Create your first one with the panel on the right.</p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {isAdmin ? (
            <CreateAssessmentPanel
              compGroups={compGroups}
              // Never ship the raw api_key to the client -- this Server
              // Component's props get serialized into the page's RSC payload,
              // so the panel only receives whether each engine is configured.
              engines={(engines || []).map((e) => ({
                key: e.key,
                display_name: e.display_name,
                enabled: e.enabled,
                configured: !!e.api_key_secret_id,
              }))}
            />
          ) : (
            <Card className="p-6">
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
                  Drafts stay private until you publish. You&apos;ll add sections and questions next. Ask an HR admin
                  about AI-generated assessments.
                </p>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
