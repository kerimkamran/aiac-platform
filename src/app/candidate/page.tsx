import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function CandidateDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assessments } = await supabase
    .from("candidate_assessments")
    .select("id, status, invited_at, started_at, submitted_at, assessments(title, time_limit_minutes)")
    .eq("candidate_id", user!.id)
    .order("invited_at", { ascending: false });

  const list = assessments || [];
  const invited = list.filter((a) => a.status === "invited").length;
  const inProgress = list.filter((a) => a.status === "in_progress").length;
  const done = list.filter((a) => ["submitted", "scored", "reviewed"].includes(a.status)).length;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Your dashboard</h1>
      <p className="text-gray-500 mb-8 text-sm">
        Track and complete the assessments you&apos;ve been invited to.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatCard label="To start" value={invited} tone="amber" />
        <StatCard label="In progress" value={inProgress} tone="brand" />
        <StatCard label="Completed" value={done} tone="accent" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Your assessments</h2>
        <Link href="/candidate/assessments" className="text-sm text-accent font-medium">
          View all →
        </Link>
      </div>

      {list.length === 0 && (
        <p className="text-sm text-gray-500 border rounded-lg p-6 bg-white">
          You have no assessment invitations yet. Your recruiter will invite you once one is ready.
        </p>
      )}

      <div className="space-y-3">
        {list.slice(0, 5).map((a) => (
          <div key={a.id} className="bg-white border rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">
                {(a.assessments as unknown as { title: string })?.title}
              </p>
              <p className="text-xs text-gray-500">
                {(a.assessments as unknown as { time_limit_minutes: number })?.time_limit_minutes} min · Status: {a.status.replace("_", " ")}
              </p>
            </div>
            {a.status === "invited" || a.status === "in_progress" ? (
              <Link
                href={`/candidate/assessments/${a.id}`}
                className="text-sm bg-brand text-white px-4 py-2 rounded-md font-medium hover:bg-brand-light"
              >
                {a.status === "invited" ? "Start" : "Continue"}
              </Link>
            ) : (
              <span className="text-xs font-medium text-accent bg-accent/10 px-3 py-1 rounded-full">
                Submitted
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "amber" | "brand" | "accent" }) {
  const toneClasses = {
    amber: "text-amber-600 bg-amber-50",
    brand: "text-brand bg-blue-50",
    accent: "text-accent bg-teal-50",
  }[tone];
  return (
    <div className="bg-white border rounded-lg p-5">
      <p className={`text-3xl font-bold ${toneClasses.split(" ")[0]}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
