import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startAssessment, submitAssessment } from "./actions";
import { AssessmentRunner, type RunnerSection } from "./runner";
import { AssessmentTimer } from "@/components/AssessmentTimer";
import { ProctoredAssessmentRunner } from "./proctoring-gate";
import { PracticeQuestion } from "@/components/PracticeQuestion";
import { Card, Icon } from "@/components/ui";
import { nowMs } from "@/lib/time";

export default async function TakeAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select("id, status, started_at, due_at, candidate_id, assessment_id, assessments(title, description, time_limit_minutes)")
    .eq("id", id)
    .single();

  if (!ca || ca.candidate_id !== user!.id) redirect("/candidate");
  if (["submitted", "scored", "reviewed"].includes(ca.status)) redirect("/candidate/assessments");

  const metaEarly = ca.assessments as unknown as { title: string; description: string; time_limit_minutes: number };

  // Deadline gate: once due_at has passed, the assessment can no longer be
  // started or continued -- HR can extend/re-invite from People & Access.
  if (ca.due_at && new Date(ca.due_at).getTime() < nowMs()) {
    return (
      <div className="p-6 lg:p-10 max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          <Icon name="clock" className="w-8 h-8 text-critical mx-auto mb-3" />
          <p className="font-bold text-foreground mb-1">The deadline for this assessment has passed</p>
          <p className="text-sm text-muted mb-1">
            {metaEarly?.title} was due by {new Date(ca.due_at).toLocaleDateString()}.
          </p>
          <p className="text-sm text-muted mb-6">
            If you still need to complete it, contact your HR representative — they can extend the deadline or send a
            new invitation.
          </p>
          <Link
            href="/candidate/assessments"
            className="inline-flex items-center gap-2 text-sm font-semibold border border-line px-4 py-2 rounded-xl text-foreground hover:border-accent transition-colors"
          >
            Back to my assessments
          </Link>
        </Card>
      </div>
    );
  }

  // Pre-start screen: the timer must never start just because the page was
  // opened. The candidate sees the format, can try an unscored practice
  // question, and starts the clock deliberately.
  if (ca.status === "invited") {
    const startWithId = startAssessment.bind(null, id);
    return (
      <div className="p-6 lg:p-10 max-w-2xl mx-auto">
        <Card className="p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-faint mb-2">Ready to begin</p>
          <h1 className="text-xl font-bold text-foreground mb-2">{metaEarly?.title}</h1>
          {metaEarly?.description && <p className="text-sm text-muted mb-4">{metaEarly.description}</p>}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted mb-6">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Icon name="timer" className="w-3.5 h-3.5" />
              {metaEarly?.time_limit_minutes} minutes once you start
            </span>
            {ca.due_at && (
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Icon name="clock" className="w-3.5 h-3.5" />
                Complete by {new Date(ca.due_at).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="mb-6">
            <PracticeQuestion />
          </div>

          <form action={startWithId}>
            <button className="w-full inline-flex items-center justify-center gap-2 bg-brand text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-brand-light transition-colors">
              <Icon name="arrowRight" className="w-4 h-4" />
              Start the timed assessment
            </button>
          </form>
          <p className="text-[11px] text-faint text-center mt-3">
            The {metaEarly?.time_limit_minutes}-minute timer begins the moment you press start.
          </p>
        </Card>
      </div>
    );
  }

  const startedAt = ca.started_at || new Date().toISOString();

  // Fetched through get_runner_questions() (SECURITY DEFINER) rather than a
  // direct assessment_sections/questions select -- the base `questions`
  // table is staff-only now (options.correct is not safe for a direct,
  // client-reachable table read), and this RPC's options are already
  // stripped of `correct` regardless of caller. See
  // supabase/migrations/0012_secure_mcq_scoring.sql.
  const [{ data: runnerRows }, { data: proctoring }] = await Promise.all([
    supabase.rpc("get_runner_questions", { p_candidate_assessment_id: id }),
    supabase.from("proctoring_settings").select("camera_enabled, storage_backend").eq("assessment_id", ca.assessment_id).maybeSingle(),
  ]);

  type RunnerRow = {
    section_id: string;
    section_title: string;
    question_id: string;
    question_type: string;
    prompt: string;
    options: { key: string; text: string }[] | null;
  };

  const rows = (runnerRows || []) as unknown as RunnerRow[];
  const sectionOrder: string[] = [];
  const sectionMap = new Map<string, RunnerSection>();
  for (const r of rows) {
    if (!sectionMap.has(r.section_id)) {
      sectionMap.set(r.section_id, { id: r.section_id, title: r.section_title, questions: [] });
      sectionOrder.push(r.section_id);
    }
    sectionMap.get(r.section_id)!.questions.push({
      id: r.question_id,
      type: r.question_type,
      prompt: r.prompt,
      options: r.options || [],
    });
  }
  const runnerSections: RunnerSection[] = sectionOrder.map((sid) => sectionMap.get(sid)!);

  const meta = ca.assessments as unknown as { title: string; description: string; time_limit_minutes: number };
  const submitWithId = submitAssessment.bind(null, id);

  const deadlineMs = new Date(startedAt).getTime() + (meta?.time_limit_minutes || 60) * 60_000;

  const totalQuestions = runnerSections.reduce((n, s) => n + s.questions.length, 0);

  if (proctoring?.camera_enabled) {
    return (
      <ProctoredAssessmentRunner
        caId={id}
        title={meta?.title || "Assessment"}
        description={meta?.description || ""}
        deadlineMs={deadlineMs}
        totalQuestions={totalQuestions}
        sections={runnerSections}
        submitAction={submitWithId}
        watermarkLabel={user?.email || "confidential"}
        storageBackend={(proctoring.storage_backend as "supabase" | "local") || "supabase"}
      />
    );
  }

  return (
    <AssessmentRunner
      caId={id}
      title={meta?.title || "Assessment"}
      description={meta?.description || ""}
      deadlineMs={deadlineMs}
      totalQuestions={totalQuestions}
      sections={runnerSections}
      submitAction={submitWithId}
      watermarkLabel={user?.email || "confidential"}
    />
  );
}
