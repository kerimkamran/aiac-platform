import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startAssessment, submitAssessment } from "./actions";
import { AssessmentRunner, type RunnerSection } from "./runner";
import { ProctoredAssessmentRunner } from "./proctoring-gate";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Surfaces";
import { ButtonLink } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { nowMs } from "@/lib/time";
import { examDeadlineMs } from "@/lib/exam-time";

export default async function TakeAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // This route sits outside the candidate workspace layout (no navigation,
  // so the exam can have focus), so it repeats the account-status check the
  // layout used to make.
  const { data: me } = await supabase.from("profiles").select("status").eq("id", user.id).single();
  if (me?.status === "deactivated") {
    await supabase.auth.signOut();
    redirect("/login?error=deactivated");
  }

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select("id, status, started_at, due_at, candidate_id, assessment_id, assessments(title, description, time_limit_minutes, content_language)")
    .eq("id", id)
    .single();

  if (!ca || ca.candidate_id !== user.id) redirect("/candidate");
  if (["submitted", "scored", "reviewed"].includes(ca.status)) redirect("/candidate/assessments");

  const metaEarly = ca.assessments as unknown as { title: string; description: string; time_limit_minutes: number };

  // Extra time granted by HR (migration 0018). Read on its own and tolerant of
  // the column not existing yet, so the exam keeps working until the migration
  // has been run: a failed read simply means no extra time.
  const { data: extraRow } = await supabase.from("candidate_assessments").select("extra_minutes").eq("id", id).maybeSingle();
  const extraMinutes = (extraRow as { extra_minutes?: number } | null)?.extra_minutes ?? 0;
  const totalMinutes = (metaEarly?.time_limit_minutes || 60) + extraMinutes;

  // Deadline gate: once due_at has passed, the assessment can no longer be
  // started or continued -- HR can extend/re-invite from People & Access.
  if (ca.due_at && new Date(ca.due_at).getTime() < nowMs()) {
    return (
      <div className="container-page max-w-2xl py-12">
        <h1 className="text-display text-foreground">The deadline for this assessment has passed.</h1>
        <p className="mt-3 text-body-large text-muted">
          {metaEarly?.title} was due by {new Date(ca.due_at).toLocaleDateString()}.
        </p>
        <p className="mt-2 text-base text-muted">
          If you still need to complete it, contact your HR representative. They can extend the deadline or send a new invitation.
        </p>
        <div className="mt-7">
          <ButtonLink href="/candidate/assessments" variant="secondary" size="lg">
            Back to my assessments
          </ButtonLink>
        </div>
      </div>
    );
  }

  // Pre-start screen: the timer must never start just because the page was
  // opened. The candidate sees the format, can try an unscored practice
  // question, and starts the clock deliberately.
  if (ca.status === "invited") {
    const startWithId = startAssessment.bind(null, id);
    return (
      <div className="container-page max-w-2xl py-10 lg:py-14">
        <p className="text-mono-label text-muted">Ready to begin</p>
        <h1 className="mt-2 text-display text-foreground">{metaEarly?.title}</h1>
        {metaEarly?.description && <p className="mt-3 text-body-large text-muted measure">{metaEarly.description}</p>}
        <ul className="mt-6 space-y-2 text-base text-foreground">
          <li className="flex items-center gap-2">
            <Icon name="timer" className="w-4 h-4 text-muted" />
            {totalMinutes} minutes once you start
            {extraMinutes > 0 && <span className="text-muted">(includes {extraMinutes} extra)</span>}
          </li>
          {ca.due_at && (
            <li className="flex items-center gap-2">
              <Icon name="clock" className="w-4 h-4 text-muted" />
              Complete by {new Date(ca.due_at).toLocaleDateString()}
            </li>
          )}
          <li className="flex items-center gap-2 text-muted">
            <Icon name="check" className="w-4 h-4" />
            Your answers save as you go. You can hide the timer.
          </li>
        </ul>

        <Card className="mt-8 p-6">
          <h2 className="text-title text-foreground">Try the practice room first</h2>
          <p className="mt-1 text-base text-muted">
            The same screen, with sample questions. There is no timer, nothing is scored and nothing is recorded.
          </p>
          <div className="mt-4">
            <ButtonLink href={`/candidate/assessments/${id}/practice`} variant="secondary">
              Open the practice room
            </ButtonLink>
          </div>
        </Card>

        <form action={startWithId} className="mt-8">
          <SubmitButton size="lg" block pendingLabel="Starting…">
            Start the timed assessment
          </SubmitButton>
        </form>
        <p className="mt-3 text-sm text-muted text-center">The {totalMinutes}-minute timer begins the moment you press start.</p>
        <p className="mt-5 text-center">
          <Link href="/candidate/assessments" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
            Back to my assessments
          </Link>
        </p>
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

  const meta = ca.assessments as unknown as {
    title: string;
    description: string;
    time_limit_minutes: number;
    content_language: string | null;
  };
  const submitWithId = submitAssessment.bind(null, id);

  const deadlineMs = examDeadlineMs(startedAt, meta?.time_limit_minutes, extraMinutes);

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
        watermarkLabel={user.email || "confidential"}
        storageBackend={(proctoring.storage_backend as "supabase" | "local") || "supabase"}
        contentLanguage={meta?.content_language}
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
      watermarkLabel={user.email || "confidential"}
      contentLanguage={meta?.content_language}
    />
  );
}
