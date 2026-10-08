import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addSection,
  addQuestion,
  addQuestionsFromCases,
  publishAssessment,
  updateProctoringSettings,
  deleteAssessment,
  updateAssessmentMeta,
  updateSectionTarget,
  deleteSection,
  deleteQuestion,
  moveSection,
  moveQuestion,
  updateQuestion,
  regenerateOneQuestion,
  createTranslatedVersion,
  duplicateAssessment,
} from "../actions";
import { PublishChecklist } from "./PublishChecklist";
import { publishChecks as publishChecksFor, type CheckQuestion, type PublishCheck } from "@/lib/publish-checks";
import { Card, Icon, PageHeader, StatusBadge } from "@/components/ui";
import { normalizePurpose } from "@/lib/purpose";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";
import { CaseLibraryPicker } from "@/components/CaseLibraryPicker";
import { InlineFormError } from "@/components/InlineFormError";
import { LEVELS, isLevelKey } from "@/lib/levels";

const TOAST_SPECS: ToastSpec[] = [
  { param: "error", variant: "error" },
  { param: "added", variant: "success" },
];

// AI generation can legitimately take 30-90+ seconds; give the underlying
// Server Action room to finish instead of racing an unnecessarily tight default.
export const maxDuration = 120;

function CompetencySelect({
  name,
  competencies,
  required = false,
  placeholder,
}: {
  name: string;
  competencies: { id: string; name: string; category: string }[];
  required?: boolean;
  placeholder: string;
}) {
  const groups = ["Core", "Leadership", "Functional"]
    .map((cat) => ({ cat, items: competencies.filter((c) => c.category === cat) }))
    .filter((g) => g.items.length > 0);
  return (
    <select
      name={name}
      required={required}
      defaultValue=""
      className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
    >
      <option value="">{placeholder}</option>
      {groups.map((g) => (
        <optgroup key={g.cat} label={`${g.cat} (${g.items.length})`}>
          {g.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export default async function BuilderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; added?: string }>;
}) {
  const { id } = await params;
  await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id || "").maybeSingle();
  const isAdmin = profile?.role === "hr_admin" || profile?.role === "system_admin";

  const { data: assessment } = await supabase.from("assessments").select("*").eq("id", id).single();
  if (!assessment) notFound();
  const purpose = normalizePurpose((assessment as { purpose?: string | null }).purpose);

  const [{ data: sections }, { data: competencies }, { data: invitees }, { data: proctoring }, { data: cases }] = await Promise.all([
    supabase
      .from("assessment_sections")
      .select("id, title, sequence, competency_id, target_score, competencies(name, category), questions(id, question_type, prompt, options, weight, sequence)")
      .eq("assessment_id", id)
      .order("sequence"),
    supabase.from("competencies").select("id, name, category").order("category").order("name"),
    supabase
      .from("candidate_assessments")
      .select("id, status, candidate_id, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email)")
      .eq("assessment_id", id),
    supabase.from("proctoring_settings").select("camera_enabled, storage_backend").eq("assessment_id", id).maybeSingle(),
    supabase
      .from("case_library")
      .select("id, competency_id, title, question_stem, question_type, difficulty, competencies(name)")
      .order("created_at", { ascending: false }),
  ]);

  const caseList = (cases || []) as unknown as {
    id: string;
    competency_id: string | null;
    title: string | null;
    question_stem: string | null;
    question_type: string;
    difficulty: string | null;
    competencies: { name: string } | null;
  }[];

  const compList = (competencies || []) as { id: string; name: string; category: string }[];

  // The brief card: where this draft came from and what context the engine
  // was given. Counts and labels only; the context text is never shown here.
  const brief = (assessment as { position_id?: string | null; target_level?: string | null; vacancy_title?: string | null; engine?: string | null; content_language?: string | null; generated_at?: string | null; generated_by?: string | null }) ;
  const [{ data: briefPosition }, { data: briefRun }] = await Promise.all([
    brief.position_id
      ? supabase.from("positions").select("id, title, department").eq("id", brief.position_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("generation_runs")
      .select("context_snapshot, engine, created_at")
      .eq("assessment_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const briefLevel = isLevelKey(brief.target_level) ? brief.target_level : null;
  const snapshot = (briefRun?.context_snapshot ?? null) as
    | { contextSent?: boolean; items?: { label: string; chars: number }[]; trimmed?: string[]; redaction?: { emails: number; phones: number } }
    | null;

  const { data: lockedData } = await supabase.rpc("assessment_is_locked", { p_assessment_id: id });
  const locked = lockedData === true;

  const questionCount = (sections || []).reduce((n, s) => n + ((s.questions as unknown[]) || []).length, 0);
  const publishChecks: PublishCheck[] = publishChecksFor({
    sections: (sections || []).map((s) => ({
      target_score: s.target_score,
      questions: (s.questions || []) as unknown as CheckQuestion[],
    })),
    hasPosition: !!brief.position_id,
  });
  const sourceLanguage = brief.content_language === "az" || brief.content_language === "ru" ? brief.content_language : "en";
  const translationTargets = (["az", "ru"] as const).filter((l) => l !== sourceLanguage);
  const addSectionWithId = addSection.bind(null, id);
  const updateProctoringWithId = updateProctoringSettings.bind(null, id);
  const updateMetaWithId = updateAssessmentMeta.bind(null, id);

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <Link href="/staff/builder" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-5 font-medium">
        <Icon name="arrowLeft" className="w-4 h-4" />
        All assessments
      </Link>

      <PageHeader title={assessment.title} subtitle={assessment.description || undefined}>
        <StatusBadge status={assessment.status} />
        <Link
          href={`/staff/builder/${id}/preview`}
          className="inline-flex items-center gap-2 border border-line text-sm font-semibold px-4 py-2.5 rounded-xl text-foreground hover:border-accent hover:text-accent-dark transition-colors"
        >
          <Icon name="eye" className="w-4 h-4" />
          Preview as candidate
        </Link>
        {assessment.status !== "published" && (
          <PublishChecklist
            title={assessment.title}
            checks={publishChecks}
            aiDraft={!!assessment.generated_by}
            action={publishAssessment.bind(null, id)}
          />
        )}
        {assessment.status === "published" && (
          <Link href="/staff/people" className="inline-flex items-center gap-2 bg-brand-deep text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-accent-dark transition-colors">
            Invite candidates
          </Link>
        )}
        {isAdmin && (
          <form action={deleteAssessment.bind(null, id)}>
            <ConfirmSubmitButton
              confirmMessage={`Delete "${assessment.title}"? This removes all its sections, questions, invitations, and candidate results. This can't be undone.`}
              icon="trash"
              className="inline-flex items-center gap-2 border border-line text-critical text-sm font-semibold px-4 py-2.5 rounded-xl hover:border-critical hover:bg-red-50 transition-colors"
            >
              Delete
            </ConfirmSubmitButton>
          </form>
        )}
      </PageHeader>

      <details className="group mb-6">
        <summary className="cursor-pointer text-sm text-muted hover:text-foreground font-semibold inline-flex items-center gap-1.5 list-none">
          <Icon name="grid" className="w-4 h-4" />
          Edit title, description &amp; time limit
        </summary>
        <Card className="p-5 mt-3">
          <form action={updateMetaWithId} className="space-y-3">
            <input
              name="title"
              required
              defaultValue={assessment.title}
              className="w-full bg-background border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <textarea
              name="description"
              defaultValue={assessment.description || ""}
              rows={2}
              className="w-full bg-background border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-muted shrink-0">Time limit (minutes)</label>
              <input
                name="time_limit_minutes"
                type="number"
                min={5}
                defaultValue={assessment.time_limit_minutes}
                className="w-32 bg-background border border-line rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button className="ml-auto bg-brand-deep text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand transition-colors">
                Save changes
              </button>
            </div>
          </form>
        </Card>
      </details>

      <ToastFromParams specs={TOAST_SPECS} />

      {locked && (
        <p role="status" className="mb-6 text-sm text-warning bg-amber-50 rounded-xl px-4 py-3">
          Candidates have started this assessment, so its questions are locked. Make a copy to change them.
        </p>
      )}

      <Card className="p-5 mb-6 flex flex-wrap items-center gap-3">
        <p className="text-sm font-bold text-foreground mr-auto">Reuse</p>
        {brief.position_id && (
          <Link href={`/staff/builder/new?position=${brief.position_id}`} className="text-sm font-semibold border border-line rounded-xl px-4 py-2 hover:border-accent">
            New from this position
          </Link>
        )}
        <form action={duplicateAssessment.bind(null, id)}>
          <button className="text-sm font-semibold border border-line rounded-xl px-4 py-2 hover:border-accent">Make an exact copy</button>
        </form>
        {translationTargets.map((lang) => (
          <form key={lang} action={createTranslatedVersion.bind(null, id)}>
            <input type="hidden" name="language" value={lang} />
            <button
              disabled={questionCount === 0}
              className="text-sm font-semibold border border-line rounded-xl px-4 py-2 hover:border-accent disabled:opacity-50"
            >
              Create {lang === "az" ? "Azərbaycan" : "Русская"} version
            </button>
          </form>
        ))}
        <p className="basis-full text-2xs text-muted">
          A translation keeps the same questions, options and correct answer, so candidates for the same vacancy get comparable tests. It is a new draft and needs its own review.
        </p>
      </Card>

      <Card className="p-6 mb-6">
        <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Icon name="layers" className="w-4 h-4 text-accent-dark" />
          Brief
        </p>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-2xs font-semibold text-muted">Position</dt>
            <dd className="font-medium text-foreground">
              {briefPosition ? (
                <Link href={`/staff/builder/positions/${briefPosition.id}`} className="text-accent-dark hover:underline">
                  {briefPosition.title}
                </Link>
              ) : (
                brief.vacancy_title || "Not linked to a position"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-2xs font-semibold text-muted">Level</dt>
            <dd className="font-medium text-foreground">
              {briefLevel ? `${LEVELS[briefLevel].label} · pass mark ${LEVELS[briefLevel].passMark}%` : "Not set"}
            </dd>
          </div>
          <div>
            <dt className="text-2xs font-semibold text-muted">Purpose and language</dt>
            <dd className="font-medium text-foreground capitalize">
              {purpose} · {brief.content_language === "az" ? "Azərbaycan dili" : brief.content_language === "ru" ? "Русский" : "English"}
            </dd>
          </div>
          <div>
            <dt className="text-2xs font-semibold text-muted">Generated with</dt>
            <dd className="font-medium text-foreground">
              {assessment.mode === "manual" || !assessment.generated_at
                ? "Written by hand or created empty"
                : `${brief.engine ?? "AI engine"}${brief.generated_at ? ` · ${new Date(brief.generated_at).toLocaleDateString()}` : ""}`}
            </dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-line pt-4 text-xs text-muted space-y-1.5">
          {!snapshot ? (
            <p>No AI generation was recorded for this draft.</p>
          ) : snapshot.contextSent && snapshot.items && snapshot.items.length > 0 ? (
            <>
              <p className="font-semibold text-foreground">Role context sent to the engine</p>
              <p>{snapshot.items.map((i) => `${i.label} (${i.chars.toLocaleString()} characters)`).join(" · ")}</p>
            </>
          ) : (
            <p>Generated from the competencies and level only. No role context was sent.</p>
          )}
          {snapshot?.trimmed && snapshot.trimmed.length > 0 && <p>Trimmed to fit the limit: {snapshot.trimmed.join(", ")}.</p>}
          {snapshot?.redaction && snapshot.redaction.emails + snapshot.redaction.phones > 0 && (
            <p>
              Removed before sending: {snapshot.redaction.emails} e-mail address(es), {snapshot.redaction.phones} phone number(s).
            </p>
          )}
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1.7fr_1fr] gap-6 items-start">
        {/* Sections & questions */}
        <div className="space-y-5">
          {(sections || []).map((section, si) => {
            const comp = section.competencies as unknown as { name: string; category: string } | null;
            const questions = ((section.questions || []) as unknown as {
              id: string;
              question_type: string;
              prompt: string;
              options: { key: string; text: string; correct?: boolean }[] | null;
              weight: number;
              sequence: number;
            }[]).sort((a, b) => a.sequence - b.sequence);
            return (
              <Card key={section.id} className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <p className="font-bold text-foreground">
                    <span className="text-muted font-semibold mr-2">S{si + 1}</span>
                    {section.title}
                  </p>
                  <div className="flex items-center gap-2">
                    {comp && (
                      <span className="text-2xs font-semibold text-accent-dark bg-accent-soft px-2.5 py-1 rounded-full">
                        {comp.name}
                      </span>
                    )}
                    {/* Design-execution-plan Phase 5 / T5.3: there was no way
                        to reorder sections or questions before this -- only
                        add and delete. Keyboard-operable up/down buttons
                        only; no drag path, since a drag-only reorder would
                        fail WCAG 2.5.7 exactly like SwipeToConfirm did
                        before Phase 4's T4.1 fix. */}
                    <div className="flex items-center gap-0.5">
                      <form action={moveSection.bind(null, section.id, id, "up")}>
                        <button
                          type="submit"
                          disabled={si === 0}
                          aria-label={`Move section "${section.title}" up`}
                          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-line-soft transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <Icon name="arrowUp" className="w-4 h-4" />
                        </button>
                      </form>
                      <form action={moveSection.bind(null, section.id, id, "down")}>
                        <button
                          type="submit"
                          disabled={si === (sections || []).length - 1}
                          aria-label={`Move section "${section.title}" down`}
                          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-line-soft transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <Icon name="arrowDown" className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                    <form action={updateSectionTarget.bind(null, section.id, id)} className="flex items-center gap-1.5">
                      <label className="text-2xs font-semibold text-muted" htmlFor={`target-${section.id}`}>
                        Target
                      </label>
                      <input
                        id={`target-${section.id}`}
                        name="target_score"
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={section.target_score ?? ""}
                        placeholder="—"
                        className="w-14 bg-surface border border-line rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <button className="text-2xs font-semibold text-accent-dark hover:underline">Set</button>
                    </form>
                    <form action={deleteSection.bind(null, section.id, id)}>
                      <ConfirmSubmitButton
                        confirmMessage={`Delete section "${section.title}" and all its questions?`}
                        icon="trash"
                        label={`Delete section "${section.title}"`}
                        className="p-1.5 rounded-lg text-muted hover:text-critical hover:bg-red-50 transition-colors"
                        compact
                      />
                    </form>
                  </div>
                </div>
                <InlineFormError field={`target_score-${section.id}`} className="text-xs font-medium text-critical -mt-3 mb-4" />

                <div className="space-y-3 mb-4">
                  {questions.map((q, qi) => (
                    <div key={q.id} className="border border-line rounded-xl px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-foreground">
                          <span className="text-muted font-semibold mr-1.5">{qi + 1}.</span>
                          {q.prompt}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="inline-flex items-center gap-1 text-2xs font-semibold text-muted bg-background ring-1 ring-inset ring-line px-2 py-1 rounded-full">
                            <Icon name={q.question_type === "mcq" ? "checkCircle" : "file"} className="w-3 h-3" />
                            {q.question_type === "mcq" ? "MCQ" : "Open"} · w{q.weight}
                          </span>
                          <div className="flex items-center gap-0.5">
                            <form action={moveQuestion.bind(null, q.id, section.id, id, "up")}>
                              <button
                                type="submit"
                                disabled={qi === 0}
                                aria-label={`Move question ${qi + 1} up`}
                                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-line-soft transition-colors disabled:opacity-30 disabled:pointer-events-none"
                              >
                                <Icon name="arrowUp" className="w-3.5 h-3.5" />
                              </button>
                            </form>
                            <form action={moveQuestion.bind(null, q.id, section.id, id, "down")}>
                              <button
                                type="submit"
                                disabled={qi === questions.length - 1}
                                aria-label={`Move question ${qi + 1} down`}
                                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-line-soft transition-colors disabled:opacity-30 disabled:pointer-events-none"
                              >
                                <Icon name="arrowDown" className="w-3.5 h-3.5" />
                              </button>
                            </form>
                          </div>
                          <form action={deleteQuestion.bind(null, q.id, section.id, id)}>
                            <ConfirmSubmitButton
                              confirmMessage="Delete this question?"
                              icon="trash"
                              label={`Delete question ${qi + 1}`}
                              className="p-1.5 rounded-lg text-muted hover:text-critical hover:bg-red-50 transition-colors"
                              compact
                            />
                          </form>
                        </div>
                      </div>
                      {q.options && q.options.length > 0 && (
                        <ul className="text-xs text-muted mt-2 grid sm:grid-cols-2 gap-1">
                          {q.options.map((o) => (
                            <li key={o.key} className={o.correct ? "text-emerald-700 font-medium" : ""}>
                              {o.key}. {o.text} {o.correct ? "✓" : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                      {locked ? (
                        <p className="text-2xs text-muted mt-2">Locked: candidates have started this assessment.</p>
                      ) : (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-semibold text-accent-dark list-none">Edit or regenerate</summary>
                          <form action={updateQuestion.bind(null, q.id, id)} className="mt-3 space-y-3 bg-background rounded-xl p-4 border border-line">
                            <label className="block text-2xs font-semibold text-muted" htmlFor={`prompt-${q.id}`}>
                              Question
                            </label>
                            <textarea
                              id={`prompt-${q.id}`}
                              name="prompt"
                              defaultValue={q.prompt}
                              rows={3}
                              className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                            {q.question_type === "mcq" && (
                              <fieldset className="space-y-2">
                                <legend className="text-2xs font-semibold text-muted mb-1">Options. Mark the one correct answer.</legend>
                                {[0, 1, 2, 3].map((i) => {
                                  const o = (q.options || [])[i];
                                  const letter = String.fromCharCode(65 + i);
                                  return (
                                    <div key={i} className="flex items-center gap-2.5">
                                      <input
                                        type="radio"
                                        name="correct_option"
                                        value={i}
                                        defaultChecked={!!o?.correct}
                                        aria-label={`Option ${letter} is the correct answer`}
                                        className="w-4 h-4 accent-[color:var(--brand)]"
                                      />
                                      <span className="text-xs font-semibold text-muted w-4">{letter}</span>
                                      <input
                                        name="option_text"
                                        defaultValue={o?.text ?? ""}
                                        aria-label={`Option ${letter}`}
                                        placeholder={`Option ${letter}`}
                                        className="flex-1 bg-surface border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                                      />
                                    </div>
                                  );
                                })}
                              </fieldset>
                            )}
                            <button className="bg-brand-deep text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand transition-colors">
                              Save question
                            </button>
                          </form>
                          <form action={regenerateOneQuestion.bind(null, q.id, id)} className="mt-3 flex flex-wrap items-end gap-2">
                            <label className="flex-1 min-w-[12rem] text-2xs font-semibold text-muted">
                              Replace with a new question (optional note)
                              <input
                                name="note"
                                maxLength={300}
                                placeholder="e.g. make it harder, more telecom"
                                className="mt-1 w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-accent"
                              />
                            </label>
                            <button className="text-sm font-semibold border border-line rounded-xl px-4 py-2 hover:border-accent">Regenerate</button>
                          </form>
                        </details>
                      )}
                    </div>
                  ))}
                  {questions.length === 0 && <p className="text-xs text-muted">No questions yet — add the first one below.</p>}
                </div>

                {!locked && (
                <details className="group">
                  <summary className="cursor-pointer text-sm text-accent-dark font-semibold inline-flex items-center gap-1.5 list-none">
                    <Icon name="plus" className="w-4 h-4" />
                    Add question
                  </summary>
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      await addQuestion(section.id, id, formData);
                    }}
                    className="mt-4 space-y-3 bg-background rounded-xl p-4 border border-line"
                  >
                    <div className="grid sm:grid-cols-2 gap-3">
                      <select name="question_type" className="bg-surface border border-line rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                        <option value="text">Open response (text)</option>
                        <option value="mcq">Multiple choice</option>
                      </select>
                      <CompetencySelect name="competency_id" competencies={compList} placeholder="(inherit section competency)" />
                    </div>
                    <textarea
                      name="prompt"
                      required
                      placeholder="Question prompt — e.g. 'Describe a time you had to deliver a result under a tight deadline…'"
                      rows={2}
                      className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map((i) => (
                        <input
                          key={i}
                          name="option_text"
                          placeholder={`Option ${String.fromCharCode(65 + i)} (MCQ)`}
                          className="bg-surface border border-line rounded-xl px-3 py-2 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
                      <label className="flex items-center gap-2">
                        Correct option (0 = A):
                        <input name="correct_option" type="number" min={0} max={3} defaultValue={0} className="w-16 bg-surface border border-line rounded-lg px-2 py-1.5" />
                      </label>
                      <label className="flex items-center gap-2">
                        Weight:
                        <input name="weight" type="number" min={1} defaultValue={1} className="w-16 bg-surface border border-line rounded-lg px-2 py-1.5" />
                      </label>
                    </div>
                    <button className="bg-brand-deep text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand transition-colors">
                      Add question
                    </button>
                  </form>
                </details>
                )}

                {caseList.length > 0 && (
                  <details className="group mt-3">
                    <summary className="cursor-pointer text-sm text-accent-dark font-semibold inline-flex items-center gap-1.5 list-none">
                      <Icon name="brain" className="w-4 h-4" />
                      Add from Case Library
                    </summary>
                    <form
                      action={async (formData: FormData) => {
                        "use server";
                        await addQuestionsFromCases(section.id, id, formData);
                      }}
                      className="mt-4 space-y-3 bg-background rounded-xl p-4 border border-line"
                    >
                      <p className="text-xs text-muted">
                        Import one or more validated case-study questions directly into this section. Pick a competency to narrow the list, then check the cases to add.
                      </p>
                      <CaseLibraryPicker cases={caseList} defaultCompetencyId={(section as unknown as { competency_id: string | null }).competency_id} />
                    </form>
                  </details>
                )}
              </Card>
            );
          })}

          {/* Add section */}
          <Card className="p-6">
            <form action={addSectionWithId} className="space-y-3">
              <p className="font-bold text-foreground text-sm flex items-center gap-2">
                <Icon name="layers" className="w-4 h-4 text-accent-dark" />
                Add section
              </p>
              <input
                name="title"
                required
                placeholder="Section title — e.g. 'Communication scenarios'"
                className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <CompetencySelect name="competency_id" competencies={compList} required placeholder="Map to a competency…" />
              <button className="w-full bg-brand-deep text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-brand transition-colors">
                Add section
              </button>
            </form>
          </Card>
        </div>

        {/* Assigned candidates (read-only) -- inviting/assigning candidates now
            happens in People & Access, where the assessment package is chosen
            as part of the invite itself, so the Builder stays focused on
            composing the assessment. */}
        <Card className="p-6 sticky top-6">
          <p className="font-bold text-foreground text-sm flex items-center gap-2 mb-1">
            <Icon name="users" className="w-4 h-4 text-accent-dark" />
            Assigned candidates
          </p>
          <p className="text-xs text-muted mb-4">
            To invite or assign someone to this assessment, go to{" "}
            <Link href="/staff/people" className="font-semibold text-accent-dark hover:underline">
              People &amp; Access
            </Link>{" "}
            and pick this assessment as the package.
          </p>
          <div className="space-y-2.5 max-h-96 overflow-y-auto">
            {(invitees || []).map((iv) => {
              const cand = iv.candidate as unknown as { full_name: string; email: string } | null;
              return (
                <div key={iv.id} className="flex items-center justify-between gap-3 text-xs border border-line rounded-xl px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{cand?.full_name}</p>
                    <p className="text-xs text-muted truncate">{cand?.email}</p>
                  </div>
                  <StatusBadge status={iv.status} />
                </div>
              );
            })}
            {(!invitees || invitees.length === 0) && <p className="text-xs text-muted">No one assigned yet.</p>}
          </div>
        </Card>
      </div>

      <Card className="p-6 mb-6">
        <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
          <Icon name="camera" className="w-4 h-4 text-accent-dark" />
          Proctoring
        </p>
        <p className="text-xs text-muted mb-4">
          When enabled, candidates are asked for camera consent and a video of the session is recorded. This is a
          consent-gated recording only — it is not analyzed automatically for gestures, emotions, or behavior.
          {proctoring == null && (
            <>
              {" "}
              {purpose === "hiring"
                ? "Defaulted on for hiring assessments — untick if this isn't needed."
                : "Defaulted off for " + (purpose === "promotion" ? "promotion" : "development") + " assessments — existing employees typically don't need camera proctoring, but you can turn it on."}
            </>
          )}
        </p>
        <form action={updateProctoringWithId} className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2.5 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              name="camera_enabled"
              defaultChecked={proctoring ? proctoring.camera_enabled : purpose === "hiring"}
              className="w-4 h-4 accent-[color:var(--brand)]"
            />
            Require camera recording for this assessment
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <span className="text-muted">Store recordings in:</span>
            <select
              name="storage_backend"
              defaultValue={proctoring?.storage_backend || "supabase"}
              className="bg-surface border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="supabase">Project database (Supabase secure storage)</option>
              <option value="local">Candidate&apos;s device only (not uploaded)</option>
            </select>
          </label>
          <button className="bg-brand-deep text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand transition-colors">
            Save
          </button>
        </form>
      </Card>
    </div>
  );
}
