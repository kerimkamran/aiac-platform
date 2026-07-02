import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { startAssessment, submitAssessment } from "./actions";
import { AssessmentRunner, type RunnerSection } from "./runner";

export default async function TakeAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select("id, status, started_at, candidate_id, assessment_id, assessments(title, description, time_limit_minutes)")
    .eq("id", id)
    .single();

  if (!ca || ca.candidate_id !== user!.id) redirect("/candidate");
  if (["submitted", "scored", "reviewed"].includes(ca.status)) redirect("/candidate/assessments");

  let startedAt = ca.started_at;
  if (ca.status === "invited" || !startedAt) {
    await startAssessment(id);
    startedAt = new Date().toISOString();
  }

  const { data: sections } = await supabase
    .from("assessment_sections")
    .select("id, title, sequence, questions(id, question_type, prompt, options, sequence)")
    .eq("assessment_id", ca.assessment_id)
    .order("sequence");

  const meta = ca.assessments as unknown as { title: string; description: string; time_limit_minutes: number };
  const submitWithId = submitAssessment.bind(null, id);

  const runnerSections: RunnerSection[] = (sections || []).map((s) => ({
    id: s.id,
    title: s.title,
    questions: ((s.questions || []) as unknown as {
      id: string;
      question_type: string;
      prompt: string;
      options: { key: string; text: string }[] | null;
      sequence: number;
    }[])
      .sort((a, b) => a.sequence - b.sequence)
      .map((q) => ({
        id: q.id,
        type: q.question_type,
        prompt: q.prompt,
        options: (q.options || []).map((o) => ({ key: o.key, text: o.text })),
      })),
  }));

  const deadlineMs = new Date(startedAt).getTime() + (meta?.time_limit_minutes || 60) * 60_000;

  return (
    <AssessmentRunner
      caId={id}
      title={meta?.title || "Assessment"}
      description={meta?.description || ""}
      deadlineMs={deadlineMs}
      sections={runnerSections}
      submitAction={submitWithId}
    />
  );
}
