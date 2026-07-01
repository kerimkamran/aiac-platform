import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function StaffCandidatesPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("candidate_assessments")
    .select(
      "id, status, overall_score, invited_at, submitted_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email), assessments(title)"
    )
    .order("invited_at", { ascending: false });

  const list = (rows || []) as unknown as {
    id: string;
    status: string;
    overall_score: number | null;
    invited_at: string;
    submitted_at: string | null;
    candidate: { full_name: string; email: string };
    assessments: { title: string };
  }[];

  const scored = list.filter((r) => r.overall_score !== null);
  const avgScore = scored.length
    ? Math.round((scored.reduce((s, r) => s + (r.overall_score || 0), 0) / scored.length) * 10) / 10
    : null;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Candidates</h1>
          <p className="text-sm text-gray-500">All candidate assessment attempts across the organization.</p>
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <p className="text-2xl font-bold text-brand">{list.length}</p>
            <p className="text-xs text-gray-500">Total invited</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-accent">{scored.length}</p>
            <p className="text-xs text-gray-500">Scored</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-700">{avgScore ?? "—"}</p>
            <p className="text-xs text-gray-500">Avg. Role Fit Score</p>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Candidate</th>
              <th className="text-left px-4 py-3">Assessment</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Role Fit Score</th>
              <th className="text-left px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{r.candidate?.full_name}</p>
                  <p className="text-xs text-gray-500">{r.candidate?.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-700">{r.assessments?.title}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                    {r.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.overall_score !== null ? (
                    <ScoreBadge score={r.overall_score} />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/staff/candidates/${r.id}`} className="text-accent font-medium">
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No candidates invited yet. Go to the Assessment Builder to publish an assessment and invite candidates.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 85 ? "bg-emerald-100 text-emerald-700" : score >= 70 ? "bg-teal-100 text-teal-700" : score >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tone}`}>{score}</span>;
}
