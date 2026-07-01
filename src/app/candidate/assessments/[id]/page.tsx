import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { startAssessment, submitAssessment } from "./actions";

type QuestionOption = { key: string; text: string };

export default async function TakeAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select("id, status, candidate_id, assessment_id, assessments(title, description, time_limit_minutes)")
    .eq("id", id)
    .single();

  if (!ca || ca.candidate_id !== user!.id) redirect("/candidate");
  if (["submitted", "scored", "reviewed"].includes(ca.status)) redirect("/candidate/assessments");

  if (ca.status === "invited") {
    await startAssessment(id);
  }

  const { data: sections } = await supabase
    .from("assessment_sections")
    .select("id, title, sequence, questions(id, question_type, prompt, options, sequence)")
    .eq("assessment_id", ca.assessment_id)
    .order("sequence");

  const meta = ca.assessments as unknown as { title: string; description: string; time_limit_minutes: number };
  const submitWithId = submitAssessment.bind(null, id);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{meta?.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{meta?.description}</p>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 inline-block px-3 py-1.5 rounded-md mt-3">
          Time limit: {meta?.time_limit_minutes} minutes · Answer every question thoughtfully — responses are
          evaluated against Azerconnect&apos;s governed competency indicators.
        </p>
      </div>

      <form action={submitWithId} className="space-y-8">
        {(sections || []).map((section, idx) => (
          <div key={section.id} className="bg-white border rounded-lg p-6">
            <h2 className="font-semibold text-brand mb-4">
              Section {idx + 1}: {section.title}
            </h2>
            <div className="space-y-6">
              {((section.questions || []) as unknown as {
                id: string;
                question_type: string;
                prompt: string;
                options: QuestionOption[] | null;
                sequence: number;
              }[])
                .sort((a, b) => a.sequence - b.sequence)
                .map((q, qIdx) => (
                  <div key={q.id}>
                    <p className="text-sm font-medium text-gray-900 mb-3">
                      {qIdx + 1}. {q.prompt}
                    </p>
                    {q.question_type === "mcq" ? (
                      <div className="space-y-2">
                        {(q.options || []).map((opt) => (
                          <label
                            key={opt.key}
                            className="flex items-center gap-3 border rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                          >
                            <input type="radio" name={`q_${q.id}`} value={opt.key} required className="accent-accent" />
                            <span>{opt.text}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        name={`q_${q.id}`}
                        required
                        rows={4}
                        placeholder="Describe a specific situation, the action you took, and the result..."
                        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}

        <button
          type="submit"
          className="w-full bg-brand text-white rounded-md py-3 text-sm font-semibold hover:bg-brand-light transition-colors"
        >
          Submit assessment
        </button>
      </form>
    </div>
  );
}
