import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { submitReview } from "./actions";

export default async function CandidateReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select(
      "id, status, overall_score, invited_at, started_at, submitted_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email), assessments(title, description)"
    )
    .eq("id", id)
    .single();

  if (!ca) notFound();

  const candidate = ca.candidate as unknown as { full_name: string; email: string };
  const assessment = ca.assessments as unknown as { title: string; description: string };

  const { data: competencyScores } = await supabase
    .from("candidate_competency_scores")
    .select("score, level, competencies(name, category)")
    .eq("candidate_assessment_id", id);

  const { data: responses } = await supabase
    .from("candidate_responses")
    .select("response_text, selected_option, score, ai_rationale, questions(prompt, question_type, options, competencies(name))")
    .eq("candidate_assessment_id", id);

  const { data: reviews } = await supabase
    .from("candidate_reviews")
    .select("decision, comment, created_at, reviewer:profiles!candidate_reviews_reviewer_id_fkey(full_name)")
    .eq("candidate_assessment_id", id)
    .order("created_at", { ascending: false });

  const submitReviewWithId = submitReview.bind(null, id);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{candidate?.full_name}</h1>
        <p className="text-sm text-gray-500">{candidate?.email}</p>
        <p className="text-sm text-gray-600 mt-2">
          {assessment?.title} · Status: <span className="font-medium">{ca.status.replace("_", " ")}</span>
        </p>
      </div>

      {ca.overall_score !== null ? (
        <div className="bg-white border rounded-lg p-6 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Overall Role Fit Score</p>
            <p className="text-4xl font-bold text-brand mt-1">{ca.overall_score}</p>
          </div>
          <p className="text-xs text-gray-400 max-w-xs text-right">
            Phase-1 simulated scoring engine. Weighted average across all mapped competencies, per
            question weight.
          </p>
        </div>
      ) : (
        <p className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-md px-4 py-3 mb-6">
          Candidate has not yet submitted this assessment.
        </p>
      )}

      {competencyScores && competencyScores.length > 0 && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Competency scores</h2>
          <div className="space-y-3">
            {(competencyScores as unknown as { score: number; level: string; competencies: { name: string; category: string } }[]).map(
              (c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.competencies?.name}</p>
                    <p className="text-xs text-gray-400">{c.competencies?.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-40 bg-gray-100 rounded-full h-2">
                      <div className="bg-accent h-2 rounded-full" style={{ width: `${c.score}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-10 text-right">{c.score}</span>
                    <span className="text-xs text-gray-500 w-24">{c.level}</span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {responses && responses.length > 0 && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Response evidence</h2>
          <div className="space-y-5">
            {(responses as unknown as {
              response_text: string | null;
              selected_option: string | null;
              score: number;
              ai_rationale: string;
              questions: { prompt: string; question_type: string; options: { key: string; text: string }[] | null; competencies: { name: string } };
            }[]).map((r, i) => (
              <div key={i} className="border-l-2 border-accent/40 pl-4">
                <p className="text-xs text-gray-400 mb-1">{r.questions?.competencies?.name}</p>
                <p className="text-sm font-medium text-gray-900 mb-1">{r.questions?.prompt}</p>
                {r.response_text ? (
                  <p className="text-sm text-gray-600 italic mb-1">&ldquo;{r.response_text}&rdquo;</p>
                ) : (
                  <p className="text-sm text-gray-600 mb-1">
                    Selected: {r.questions?.options?.find((o) => o.key === r.selected_option)?.text}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  Score: <span className="font-semibold text-gray-600">{r.score}</span> — {r.ai_rationale}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border rounded-lg p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Recruiter decision</h2>
        <form action={submitReviewWithId} className="space-y-3">
          <select name="decision" required className="w-full border rounded-md px-3 py-2 text-sm">
            <option value="">Select a decision…</option>
            <option value="shortlist">Shortlist</option>
            <option value="hold">Hold</option>
            <option value="reject">Reject</option>
          </select>
          <textarea
            name="comment"
            rows={3}
            placeholder="Add reviewer notes (optional)"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="bg-brand text-white px-5 py-2.5 rounded-md text-sm font-semibold hover:bg-brand-light"
          >
            Submit decision
          </button>
        </form>

        {reviews && reviews.length > 0 && (
          <div className="mt-6 space-y-2 border-t pt-4">
            {(reviews as unknown as { decision: string; comment: string; created_at: string; reviewer: { full_name: string } }[]).map(
              (r, i) => (
                <p key={i} className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{r.reviewer?.full_name}</span> marked{" "}
                  <span className="font-medium">{r.decision}</span>
                  {r.comment ? ` — "${r.comment}"` : ""}
                </p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
