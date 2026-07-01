import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function CandidateAssessmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assessments } = await supabase
    .from("candidate_assessments")
    .select("id, status, invited_at, assessments(title, description, time_limit_minutes)")
    .eq("candidate_id", user!.id)
    .order("invited_at", { ascending: false });

  const list = assessments || [];

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">My assessments</h1>

      {list.length === 0 && (
        <p className="text-sm text-gray-500 border rounded-lg p-6 bg-white">
          No assessments yet.
        </p>
      )}

      <div className="space-y-3">
        {list.map((a) => {
          const meta = a.assessments as unknown as { title: string; description: string; time_limit_minutes: number };
          return (
            <div key={a.id} className="bg-white border rounded-lg p-5">
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-semibold text-gray-900">{meta?.title}</h2>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                  {a.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-3">{meta?.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{meta?.time_limit_minutes} minute time limit</span>
                {["invited", "in_progress"].includes(a.status) ? (
                  <Link
                    href={`/candidate/assessments/${a.id}`}
                    className="text-sm bg-brand text-white px-4 py-2 rounded-md font-medium hover:bg-brand-light"
                  >
                    {a.status === "invited" ? "Start assessment" : "Continue"}
                  </Link>
                ) : (
                  <span className="text-xs font-medium text-accent">Submitted — under review</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
