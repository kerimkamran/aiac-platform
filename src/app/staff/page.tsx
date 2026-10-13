import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Avatar, Icon, ScoreBadge, StatusBadge } from "@/components/ui";

// Home is the review queue (plan v2): candidates the AI has scored and a
// person still has to confirm, then the most recent submissions. Dashboards
// and charts were removed. Both lists are paged, so nothing is silently cut
// at 1,000 rows.
const QUEUE_PAGE = 50;
const RECENT_LIMIT = 10;

type Row = {
  id: string;
  status: string;
  overall_score: number | null;
  submitted_at: string | null;
  candidate: { full_name: string; email: string } | null;
  assessments: { title: string; vacancy_title: string | null } | null;
};

const ROW_SELECT =
  "id, status, overall_score, submitted_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email), assessments(title, vacancy_title)";

export default async function StaffHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: queue, count: queueCount }, { data: recent }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).single(),
    supabase
      .from("candidate_assessments")
      .select(ROW_SELECT, { count: "exact" })
      .eq("status", "scored")
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .range(0, QUEUE_PAGE - 1),
    supabase
      .from("candidate_assessments")
      .select(ROW_SELECT)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(RECENT_LIMIT),
  ]);

  const firstName = (profile?.full_name || "there").split(" ")[0];
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const waiting = (queue || []) as unknown as Row[];
  const total = queueCount ?? waiting.length;
  const recentRows = (recent || []) as unknown as Row[];

  return (
    <div className="max-w-[1180px] mx-auto px-6 lg:px-10">
      <div className="pt-10 pb-6 flex items-baseline justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Good to see you, {firstName}</h1>
        <span className="text-xs text-muted">{today}</span>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-10 pb-14">
        <section aria-labelledby="review-queue">
          <div className="flex items-center justify-between mb-4">
            <h2 id="review-queue" className="text-sm font-semibold text-foreground">
              Review queue
              {total > 0 && <span className="ml-2 text-muted font-normal">{total} waiting</span>}
            </h2>
            <Link href="/staff/reports/candidates" className="text-xs font-medium text-muted hover:text-foreground">
              All candidates
            </Link>
          </div>

          {waiting.length === 0 ? (
            <p className="text-sm text-muted py-8 border-t border-line">Nothing is waiting for review.</p>
          ) : (
            <div className="border-t border-line">
              {waiting.map((r) => (
                <QueueRow key={r.id} row={r} />
              ))}
              {total > waiting.length && (
                <p className="text-xs text-muted pt-3">
                  Showing the first {waiting.length} of {total}.{" "}
                  <Link href="/staff/reports/candidates?status=scored" className="font-semibold text-accent-dark hover:underline">
                    See all
                  </Link>
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-12 mb-4">
            <h2 className="text-sm font-semibold text-foreground">Recent submissions</h2>
          </div>
          {recentRows.length === 0 ? (
            <p className="text-sm text-muted py-8 border-t border-line">Nothing submitted yet. Publish an assessment and invite candidates from People &amp; Access.</p>
          ) : (
            <div className="border-t border-line">
              {recentRows.map((r) => (
                <QueueRow key={r.id} row={r} />
              ))}
            </div>
          )}
        </section>

        <aside className="pt-2 space-y-4">
          <Link
            href="/staff/builder/new"
            className="flex items-center justify-center gap-2 bg-brand-deep text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-brand transition-colors"
          >
            <Icon name="plus" className="w-4 h-4" />
            New assessment
          </Link>
          <Link
            href="/staff/builder"
            className="flex items-center justify-center gap-2 border border-line text-sm font-semibold py-2.5 rounded-xl hover:border-accent"
          >
            Assessment Builder
          </Link>
        </aside>
      </div>
    </div>
  );
}

function QueueRow({ row }: { row: Row }) {
  return (
    <Link
      href={`/staff/reports/candidates/${row.id}`}
      className="flex items-center gap-3.5 py-3.5 border-b border-line hover:bg-line-soft/40 transition-colors -mx-2 px-2"
    >
      <Avatar name={row.candidate?.full_name || "?"} className="w-7 h-7 text-2xs" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">{row.candidate?.full_name}</p>
        <p className="text-2xs text-muted truncate">{row.assessments?.vacancy_title || row.assessments?.title}</p>
      </div>
      <StatusBadge status={row.status} />
      {row.overall_score !== null && <ScoreBadge score={Math.round(row.overall_score)} />}
    </Link>
  );
}
