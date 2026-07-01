import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { createAssessment } from "./actions";

export default async function BuilderListPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, title, status, time_limit_minutes, created_at, assessment_sections(id)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Assessment Builder</h1>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-6">{error}</p>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-3">
          {(assessments || []).map((a) => (
            <Link
              key={a.id}
              href={`/staff/builder/${a.id}`}
              className="block bg-white border rounded-lg p-4 hover:border-accent transition-colors"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900">{a.title}</p>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    a.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {a.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {(a.assessment_sections || []).length} section(s) · {a.time_limit_minutes} min
              </p>
            </Link>
          ))}
          {(!assessments || assessments.length === 0) && (
            <p className="text-sm text-gray-500 border rounded-lg p-6 bg-white">No assessments yet — create one.</p>
          )}
        </div>

        <div>
          <form action={createAssessment} className="bg-white border rounded-lg p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 text-sm">New assessment</h2>
            <input
              name="title"
              required
              placeholder="Title"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
            <textarea
              name="description"
              placeholder="Description"
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
            <div>
              <label className="text-xs text-gray-500">Time limit (minutes)</label>
              <input
                name="time_limit_minutes"
                type="number"
                defaultValue={60}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <button className="w-full bg-brand text-white rounded-md py-2 text-sm font-semibold hover:bg-brand-light">
              Create
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
