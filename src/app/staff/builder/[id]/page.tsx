import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { addSection, addQuestion, publishAssessment, inviteCandidate } from "../actions";

export default async function BuilderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: assessment } = await supabase.from("assessments").select("*").eq("id", id).single();
  if (!assessment) notFound();

  const { data: sections } = await supabase
    .from("assessment_sections")
    .select("id, title, sequence, competencies(name), questions(id, question_type, prompt, options, weight, sequence)")
    .eq("assessment_id", id)
    .order("sequence");

  const { data: competencies } = await supabase
    .from("competencies")
    .select("id, name, category")
    .order("category")
    .order("name");

  const { data: invitees } = await supabase
    .from("candidate_assessments")
    .select("id, status, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email)")
    .eq("assessment_id", id);

  const addSectionWithId = addSection.bind(null, id);
  const inviteCandidateWithId = inviteCandidate.bind(null, id);

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{assessment.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{assessment.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              assessment.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            {assessment.status}
          </span>
          {assessment.status !== "published" && (
            <form action={async () => { "use server"; await publishAssessment(id); }}>
              <button className="bg-accent text-white text-xs font-semibold px-3 py-2 rounded-md hover:opacity-90">
                Publish
              </button>
            </form>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-6">{error}</p>
      )}

      <div className="space-y-5 mb-8">
        {(sections || []).map((section) => (
          <div key={section.id} className="bg-white border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-brand">{section.title}</h2>
              <span className="text-xs text-gray-400">
                {(section.competencies as unknown as { name: string })?.name}
              </span>
            </div>

            <div className="space-y-3 mb-4">
              {((section.questions || []) as unknown as {
                id: string;
                question_type: string;
                prompt: string;
                options: { key: string; text: string; correct?: boolean }[] | null;
                weight: number;
                sequence: number;
              }[])
                .sort((a, b) => a.sequence - b.sequence)
                .map((q) => (
                  <div key={q.id} className="text-sm border-l-2 border-gray-200 pl-3">
                    <p className="text-gray-900">
                      {q.prompt} <span className="text-xs text-gray-400">({q.question_type}, w={q.weight})</span>
                    </p>
                    {q.options && (
                      <ul className="text-xs text-gray-500 mt-1">
                        {q.options.map((o) => (
                          <li key={o.key}>
                            {o.key}. {o.text} {o.correct ? "✓" : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              {(!section.questions || section.questions.length === 0) && (
                <p className="text-xs text-gray-400">No questions yet.</p>
              )}
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-accent font-medium">+ Add question</summary>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await addQuestion(section.id, id, formData);
                }}
                className="mt-3 space-y-2 bg-gray-50 rounded-md p-3"
              >
                <select name="question_type" className="w-full border rounded-md px-2 py-1.5 text-xs">
                  <option value="text">Open response (text)</option>
                  <option value="mcq">Multiple choice</option>
                </select>
                <textarea
                  name="prompt"
                  required
                  placeholder="Question prompt"
                  rows={2}
                  className="w-full border rounded-md px-2 py-1.5 text-xs"
                />
                <select name="competency_id" className="w-full border rounded-md px-2 py-1.5 text-xs" defaultValue={assessment ? undefined : ""}>
                  <option value="">(inherit section competency)</option>
                  {(competencies || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.category})
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      name="option_text"
                      placeholder={`Option ${String.fromCharCode(65 + i)} (MCQ only)`}
                      className="border rounded-md px-2 py-1.5 text-xs"
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Correct option index (0=A):</label>
                  <input name="correct_option" type="number" defaultValue={0} className="w-16 border rounded-md px-2 py-1 text-xs" />
                  <label className="text-xs text-gray-500 ml-4">Weight:</label>
                  <input name="weight" type="number" defaultValue={1} className="w-16 border rounded-md px-2 py-1 text-xs" />
                </div>
                <button className="bg-brand text-white text-xs font-semibold px-3 py-1.5 rounded-md">Add question</button>
              </form>
            </details>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <form action={addSectionWithId} className="bg-white border rounded-lg p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm">Add section</h2>
          <input name="title" required placeholder="Section title" className="w-full border rounded-md px-3 py-2 text-sm" />
          <select name="competency_id" required className="w-full border rounded-md px-3 py-2 text-sm">
            <option value="">Select competency…</option>
            {(competencies || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.category})
              </option>
            ))}
          </select>
          <button className="w-full bg-brand text-white rounded-md py-2 text-sm font-semibold hover:bg-brand-light">
            Add section
          </button>
        </form>

        <div className="bg-white border rounded-lg p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-3">Invited candidates</h2>
          <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
            {(invitees || []).map((iv) => (
              <p key={iv.id} className="text-xs text-gray-600 flex justify-between">
                <span>{(iv.candidate as unknown as { full_name: string })?.full_name}</span>
                <span className="text-gray-400">{iv.status}</span>
              </p>
            ))}
            {(!invitees || invitees.length === 0) && <p className="text-xs text-gray-400">No invitations yet.</p>}
          </div>
          <form action={inviteCandidateWithId} className="flex gap-2">
            <input
              name="email"
              type="email"
              required
              placeholder="candidate@email.com"
              className="flex-1 border rounded-md px-3 py-2 text-xs"
            />
            <button className="bg-accent text-white text-xs font-semibold px-3 py-2 rounded-md">Invite</button>
          </form>
          <p className="text-[11px] text-gray-400 mt-2">Candidate must already have signed up with this email.</p>
        </div>
      </div>
    </div>
  );
}
