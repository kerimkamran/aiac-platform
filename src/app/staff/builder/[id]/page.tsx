import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addSection,
  addQuestion,
  publishAssessment,
  inviteCandidate,
  updateProctoringSettings,
  deleteAssessment,
  updateAssessmentMeta,
  deleteSection,
  deleteQuestion,
} from "../actions";
import { Card, Icon, PageHeader, StatusBadge } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";

const TOAST_SPECS: ToastSpec[] = [{ param: "error", variant: "error" }];

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
  searchParams: Promise<{ error?: string }>;
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

  const [{ data: sections }, { data: competencies }, { data: invitees }, { data: proctoring }] = await Promise.all([
    supabase
      .from("assessment_sections")
      .select("id, title, sequence, competencies(name, category), questions(id, question_type, prompt, options, weight, sequence)")
      .eq("assessment_id", id)
      .order("sequence"),
    supabase.from("competencies").select("id, name, category").order("category").order("name"),
    supabase
      .from("candidate_assessments")
      .select("id, status, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email)")
      .eq("assessment_id", id),
    supabase.from("proctoring_settings").select("camera_enabled, storage_backend").eq("assessment_id", id).maybeSingle(),
  ]);

  const compList = (competencies || []) as { id: string; name: string; category: string }[];
  const questionCount = (sections || []).reduce((n, s) => n + ((s.questions as unknown[]) || []).length, 0);
  const addSectionWithId = addSection.bind(null, id);
  const inviteCandidateWithId = inviteCandidate.bind(null, id);
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
        {assessment.status !== "published" && (
          <form
            action={async () => {
              "use server";
              await publishAssessment(id);
            }}
          >
            <ConfirmSubmitButton
              confirmMessage={`Publish "${assessment.title}"? Candidates will be able to start taking it.`}
              icon="zap"
              tone="accent"
              disabled={questionCount === 0}
              className="inline-flex items-center gap-2 bg-accent text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              Publish
            </ConfirmSubmitButton>
          </form>
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
              <button className="ml-auto bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-light transition-colors">
                Save changes
              </button>
            </div>
          </form>
        </Card>
      </details>

      <ToastFromParams specs={TOAST_SPECS} />

      <Card className="p-6 mb-6">
        <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
          <Icon name="camera" className="w-4 h-4 text-brand" />
          Proctoring
        </p>
        <p className="text-xs text-muted mb-4">
          When enabled, candidates are asked for camera consent and a video of the session is recorded. This is a
          consent-gated recording only — it is not analyzed automatically for gestures, emotions, or behavior.
        </p>
        <form action={updateProctoringWithId} className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2.5 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              name="camera_enabled"
              defaultChecked={proctoring?.camera_enabled || false}
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
          <button className="bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-light transition-colors">
            Save
          </button>
        </form>
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
                    <span className="text-faint font-semibold mr-2">S{si + 1}</span>
                    {section.title}
                  </p>
                  <div className="flex items-center gap-2">
                    {comp && (
                      <span className="text-[11px] font-semibold text-accent-dark bg-accent-soft px-2.5 py-1 rounded-full">
                        {comp.name}
                      </span>
                    )}
                    <form action={deleteSection.bind(null, section.id, id)}>
                      <ConfirmSubmitButton
                        confirmMessage={`Delete section "${section.title}" and all its questions?`}
                        icon="trash"
                        className="p-1.5 rounded-lg text-faint hover:text-critical hover:bg-red-50 transition-colors"
                        compact
                      />
                    </form>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  {questions.map((q, qi) => (
                    <div key={q.id} className="border border-line rounded-xl px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-foreground">
                          <span className="text-faint font-semibold mr-1.5">{qi + 1}.</span>
                          {q.prompt}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-muted bg-background ring-1 ring-inset ring-line px-2 py-1 rounded-full">
                            <Icon name={q.question_type === "mcq" ? "checkCircle" : "file"} className="w-3 h-3" />
                            {q.question_type === "mcq" ? "MCQ" : "Open"} · w{q.weight}
                          </span>
                          <form action={deleteQuestion.bind(null, q.id, section.id, id)}>
                            <ConfirmSubmitButton
                              confirmMessage="Delete this question?"
                              icon="trash"
                              className="p-1 rounded-lg text-faint hover:text-critical hover:bg-red-50 transition-colors"
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
                    </div>
                  ))}
                  {questions.length === 0 && <p className="text-xs text-faint">No questions yet — add the first one below.</p>}
                </div>

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
                      className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map((i) => (
                        <input
                          key={i}
                          name="option_text"
                          placeholder={`Option ${String.fromCharCode(65 + i)} (MCQ)`}
                          className="bg-surface border border-line rounded-xl px-3 py-2 text-xs placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
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
                    <button className="bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-light transition-colors">
                      Add question
                    </button>
                  </form>
                </details>
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
                className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <CompetencySelect name="competency_id" competencies={compList} required placeholder="Map to a competency…" />
              <button className="w-full bg-brand text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-brand-light transition-colors">
                Add section
              </button>
            </form>
          </Card>
        </div>

        {/* Invite panel */}
        <Card className="p-6 sticky top-6">
          <p className="font-bold text-foreground text-sm flex items-center gap-2 mb-1">
            <Icon name="send" className="w-4 h-4 text-accent-dark" />
            Invite candidates
          </p>
          <p className="text-xs text-muted mb-4">
            Candidates don&apos;t need an existing account — we&apos;ll create one and email them a link to set their password.
          </p>
          <form action={inviteCandidateWithId} className="flex flex-col gap-2 mb-5">
            <input
              name="full_name"
              type="text"
              placeholder="Full name"
              className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="flex gap-2">
              <input
                name="email"
                type="email"
                required
                placeholder="candidate@email.com"
                className="flex-1 min-w-0 bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button className="bg-accent text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-accent-dark transition-colors shrink-0">
                Invite
              </button>
            </div>
          </form>
          <div className="space-y-2.5 max-h-72 overflow-y-auto">
            {(invitees || []).map((iv) => {
              const cand = iv.candidate as unknown as { full_name: string; email: string } | null;
              return (
                <div key={iv.id} className="flex items-center justify-between gap-3 text-[13px] border border-line rounded-xl px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{cand?.full_name}</p>
                    <p className="text-xs text-muted truncate">{cand?.email}</p>
                  </div>
                  <StatusBadge status={iv.status} />
                </div>
              );
            })}
            {(!invitees || invitees.length === 0) && <p className="text-xs text-faint">No invitations yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
