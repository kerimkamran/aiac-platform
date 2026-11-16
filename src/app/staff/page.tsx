import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { WelcomeMark } from "@/components/WelcomeMark";
import { Avatar, ScoreBadge, StatusBadge } from "@/components/ui";
import { HomeLauncher, type LauncherTile } from "@/components/HomeLauncher";
import { ageLabel, daysSince, greeting, REVIEW_TARGET_DAYS } from "@/lib/dates";

// Staff home (Clear Horizon plan, section 10): a statement of what needs a
// person, the pipeline horizon, and the first few waiting reviews. Counts use
// head-only queries, so the page stays cheap however many candidates exist.
const QUEUE_SHOWN = 5;
const RECENT_SHOWN = 5;
const STAGES = [
  { key: "invited", label: "Invited" },
  { key: "in_progress", label: "In progress" },
  { key: "submitted", label: "Submitted" },
  { key: "scored", label: "Ready for review" },
  { key: "reviewed", label: "Reviewed" },
] as const;

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
  const nowIso = new Date().toISOString();

  const counts = await Promise.all(
    STAGES.map((s) => supabase.from("candidate_assessments").select("id", { count: "exact", head: true }).eq("status", s.key))
  );
  const [{ data: profile }, { data: queue }, { data: recent }, { count: overdue }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user!.id).single(),
    supabase
      .from("candidate_assessments")
      .select(ROW_SELECT)
      .eq("status", "scored")
      .order("submitted_at", { ascending: true, nullsFirst: false })
      .limit(QUEUE_SHOWN),
    supabase
      .from("candidate_assessments")
      .select(ROW_SELECT)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(RECENT_SHOWN),
    supabase
      .from("candidate_assessments")
      .select("id", { count: "exact", head: true })
      .in("status", ["invited", "in_progress"])
      .lt("due_at", nowIso),
  ]);

  const countOf = (key: string) => counts[STAGES.findIndex((s) => s.key === key)].count ?? 0;
  const waitingCount = countOf("scored");
  const role = (profile as { role?: string } | null)?.role ?? "recruiter";
  const isAdmin = ["hr_admin", "system_admin", "org_admin"].includes(role);
  const canBuild = role !== "hiring_manager";
  // The home is a menu: every function people use is one tap away.
  const tiles: LauncherTile[] = [
    {
      href: "/staff/review",
      title: "Review candidates",
      body: waitingCount === 0 ? "Nothing is waiting for a person." : "Read the answers and make a decision.",
      icon: "check",
      count: waitingCount,
      countLabel: "waiting for review",
      primary: waitingCount > 0,
    },
    {
      href: "/staff/reports/candidates",
      title: "Candidates",
      body: "Everyone invited, with status and scores.",
      icon: "users",
      count: countOf("in_progress"),
      countLabel: "taking a test now",
    },
  ];
  if (canBuild) {
    tiles.push(
      { href: "/staff/invite", title: "Invite candidates", body: "Send a test by email or copy the link.", icon: "send" },
      { href: "/staff/builder", title: "Tests", body: "Open, edit and publish your tests.", icon: "layers" },
      { href: "/staff/builder/new", title: "New test", body: "Build a test step by step, with AI help.", icon: "wand" }
    );
  }
  tiles.push({
    href: "/staff/reports/candidates?status=invited",
    title: "Past the deadline",
    body: "Invited people who have not started in time.",
    icon: "clock",
    count: overdue ?? 0,
    countLabel: "past the deadline",
  });
  if (isAdmin) {
    tiles.push(
      { href: "/staff/people", title: "People & access", body: "Add people, change roles, send invites again.", icon: "shield" },
      { href: "/staff/settings", title: "Settings", body: "Organisation settings and templates.", icon: "sliders" }
    );
  }
  const waiting = (queue || []) as unknown as Row[];
  const recentRows = (recent || []) as unknown as Row[];
  const oldest = waiting[0]?.submitted_at ?? null;
  const oldestDays = daysSince(oldest);
  const firstName = (profile?.full_name || "").split(" ")[0];

  return (
    <div className="container-page py-8 lg:py-12">
      <div className="flex items-center gap-3">
        <WelcomeMark />
        <p className="text-base font-semibold text-muted">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </p>
      </div>
      <h1 className="mt-2 text-display text-foreground measure">
        {waitingCount === 0
          ? "You're all caught up."
          : waitingCount === 1
            ? "1 candidate is waiting for your review."
            : `${waitingCount} candidates are waiting for your review.`}
      </h1>
      <p className="mt-2 text-body-large text-muted measure">
        {waitingCount === 0
          ? "Nothing needs a person right now."
          : oldest
            ? `The longest wait is ${ageLabel(oldest)}${oldestDays > REVIEW_TARGET_DAYS ? `, past the ${REVIEW_TARGET_DAYS}-day target` : ""}.`
            : "Every score is a draft until a person confirms it."}
      </p>

      <section aria-labelledby="menu-h" className="mt-10">
        <h2 id="menu-h" className="mb-4 text-title-large text-foreground">
          What would you like to do?
        </h2>
        <HomeLauncher tiles={tiles} label="Functions" />
      </section>

      <div className="mt-14 grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="waiting-h">
          <div className="flex items-baseline justify-between">
            <h2 id="waiting-h" className="text-title-large text-foreground">
              Waiting longest
            </h2>
            <Link href="/staff/reports/candidates?status=scored" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
              See all
            </Link>
          </div>
          {waiting.length === 0 ? (
            <p className="mt-3 border-t border-line py-6 text-base text-muted">Nothing is waiting for review.</p>
          ) : (
            <div className="mt-3 border-t border-line">
              {waiting.map((r) => (
                <QueueRow key={r.id} row={r} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="recent-h">
          <h2 id="recent-h" className="text-title-large text-foreground">
            Recent submissions
          </h2>
          {recentRows.length === 0 ? (
            <p className="mt-3 border-t border-line py-6 text-base text-muted">
              Nothing submitted yet. Publish a test, then invite candidates.
            </p>
          ) : (
            <div className="mt-3 border-t border-line">
              {recentRows.map((r) => (
                <QueueRow key={r.id} row={r} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function QueueRow({ row }: { row: Row }) {
  return (
    <Link
      href={`/staff/reports/candidates/${row.id}`}
      className="press flex min-h-16 items-center gap-3.5 border-b border-line-soft px-2 -mx-2 py-3 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
    >
      <Avatar name={row.candidate?.full_name || "?"} className="w-9 h-9 text-xs" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground">{row.candidate?.full_name}</p>
        <p className="truncate text-sm text-muted">
          {row.assessments?.vacancy_title || row.assessments?.title}
          {row.submitted_at ? ` · ${ageLabel(row.submitted_at)}` : ""}
        </p>
      </div>
      <StatusBadge status={row.status} />
      {row.overall_score !== null && <ScoreBadge score={Math.round(row.overall_score)} />}
    </Link>
  );
}
