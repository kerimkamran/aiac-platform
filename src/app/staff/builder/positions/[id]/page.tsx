import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Icon, PageHeader, StatusBadge } from "@/components/ui";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { LEVELS, isLevelKey } from "@/lib/levels";
import { MAX_REFERENCE_FILES, REFERENCE_FILE_MAX_CHARS } from "@/lib/ai-context";
import { addPositionFile, removePositionFile, setPositionArchived, updatePosition } from "../actions";
import { PositionForm } from "../PositionForm";

const TOAST_SPECS: ToastSpec[] = [
  { param: "error", variant: "error" },
  { param: "added", variant: "success" },
];

export default async function PositionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; added?: string }>;
}) {
  const { id } = await params;
  await searchParams;
  const supabase = await createClient();

  const [{ data: position }, { data: files }, { data: drafts }] = await Promise.all([
    supabase.from("positions").select("*").eq("id", id).maybeSingle(),
    supabase.from("position_files").select("id, filename, size_bytes, created_at").eq("position_id", id).order("created_at"),
    supabase
      .from("assessments")
      .select("id, title, status, target_level, created_at")
      .eq("position_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (!position) notFound();

  const archived = !!position.archived_at;
  const updateWithId = updatePosition.bind(null, id);
  const addFileWithId = addPositionFile.bind(null, id);

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <Link href="/staff/builder/positions" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-5 font-medium">
        <Icon name="arrowLeft" className="w-4 h-4" />
        All positions
      </Link>

      <PageHeader title={position.title} subtitle={position.department || "No department set"}>
        {archived ? (
          <span className="text-2xs font-semibold px-2 py-[3px] rounded bg-line-soft text-muted">Archived</span>
        ) : (
          <Link
            href={`/staff/builder/new?position=${id}`}
            className="inline-flex items-center gap-2 bg-brand-deep text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand transition-colors"
          >
            <Icon name="plus" className="w-4 h-4" />
            New assessment for this position
          </Link>
        )}
      </PageHeader>

      <ToastFromParams specs={TOAST_SPECS} />

      <Card className="p-6 mb-6">
        <PositionForm
          action={updateWithId}
          initial={{
            title: position.title,
            department: position.department ?? "",
            defaultLevel: isLevelKey(position.default_level) ? position.default_level : "manager",
            jobDescription: position.job_description ?? "",
            notes: position.notes ?? "",
          }}
          submitLabel="Save position"
        />
      </Card>

      <Card className="p-6 mb-6 space-y-4">
        <div>
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            <Icon name="file" className="w-4 h-4 text-accent-dark" />
            Reference files
          </p>
          <p className="text-xs text-muted mt-1">
            Up to {MAX_REFERENCE_FILES} .md or .txt files, {Math.round(REFERENCE_FILE_MAX_CHARS / 1024)} KB each. Sent to AI engines only if they are approved for context.
          </p>
        </div>
        {(files || []).length > 0 ? (
          <ul className="divide-y divide-line">
            {(files || []).map((f) => (
              <li key={f.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{f.filename}</span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-2xs text-muted">{Math.max(1, Math.round(f.size_bytes / 1024))} KB</span>
                  <form action={removePositionFile.bind(null, id, f.id)}>
                    <ConfirmSubmitButton
                      confirmMessage={`Remove ${f.filename} from this position?`}
                      icon="trash"
                      label={`Remove ${f.filename}`}
                      className="p-1.5 rounded-lg text-muted hover:text-critical hover:bg-red-50 transition-colors"
                      compact
                    />
                  </form>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No reference files yet.</p>
        )}
        {(files || []).length < MAX_REFERENCE_FILES && (
          <form action={addFileWithId} className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              name="file"
              accept=".md,.txt,text/markdown,text/plain"
              required
              className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-accent-dark file:font-semibold"
            />
            <button className="text-sm font-semibold border border-line rounded-xl px-4 py-2 hover:border-accent">Add file</button>
          </form>
        )}
      </Card>

      <Card className="p-6 mb-6">
        <p className="text-sm font-bold text-foreground mb-3">Assessments for this position</p>
        {(drafts || []).length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {(drafts || []).map((d) => (
              <li key={d.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <Link href={`/staff/builder/${d.id}`} className="font-medium text-accent-dark hover:underline truncate">
                  {d.title}
                </Link>
                <span className="flex items-center gap-3 shrink-0">
                  {isLevelKey(d.target_level) && <span className="text-2xs text-muted">{LEVELS[d.target_level].label}</span>}
                  <StatusBadge status={d.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex justify-end">
        <form action={setPositionArchived.bind(null, id, !archived)}>
          <button className="text-sm font-semibold text-muted hover:text-foreground hover:underline">
            {archived ? "Restore this position" : "Archive this position"}
          </button>
        </form>
      </div>
    </div>
  );
}
