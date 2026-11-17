import { extraMinutesFor } from "@/lib/extra-minutes";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { WelcomeMark } from "@/components/WelcomeMark";
import { EmptyState, StatusBadge } from "@/components/ui";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { HomeLauncher } from "@/components/HomeLauncher";
import { ListRow, PrimaryCard } from "@/components/ui/Surfaces";
import { PathHorizon, type PathStep } from "@/components/horizon/PathHorizon";
import { dueLabelIn, fillText, formatDateIn, greetingIn } from "@/lib/dates";
import { getT } from "@/i18n/server";

type Row = {
  id: string;
  status: string;
  invited_at: string;
  due_at: string | null;
  assessments: { title: string; time_limit_minutes: number } | null;
};

const CURRENT: Record<string, number> = { invited: 0, in_progress: 1, submitted: 2, scored: 3, reviewed: 4 };

function pathFor(status: string, steps: string[]): PathStep[] {
  const cur = CURRENT[status] ?? 0;
  return steps.map((label, i) => ({ label, state: i < cur ? "done" : i === cur ? "current" : "todo" }));
}

// Candidate home (Clear Horizon plan, section 11): one next step, your place on
// the path, and plain-language statuses. A person reviews every score, so the
// words "AI scored" never appear here.
export default async function CandidateHome() {
  const { lang, t } = await getT();
  const h = t.candidate.home;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: assessments }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).single(),
    supabase
      .from("candidate_assessments")
      .select("id, status, invited_at, due_at, assessments(title, time_limit_minutes)")
      .eq("candidate_id", user!.id)
      .order("invited_at", { ascending: false }),
  ]);

  const list = (assessments || []) as unknown as Row[];
  const extra = await extraMinutesFor(supabase, list.map((a) => a.id));
  const minutesOf = (a: Row) => (a.assessments?.time_limit_minutes ?? 0) + (extra.get(a.id) ?? 0);
  const next = list.find((a) => a.status === "in_progress") || list.find((a) => a.status === "invited");
  const focus = next || list[0];
  const firstName = (profile?.full_name || "").split(" ")[0];

  return (
    <div className="container-page max-w-4xl py-8 lg:py-12">
      <div className="flex items-center gap-3">
        <WelcomeMark />
        <p className="text-base font-semibold text-muted">
          {greetingIn(t.dates)}
          {firstName ? `, ${firstName}` : ""}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="clipboard"
            title={h.emptyTitle}
            body={h.emptyBody}
          />
        </div>
      ) : (
        <>
          <h1 className="mt-2 text-display text-foreground measure">
            {next ? (next.status === "in_progress" ? h.headingInProgress : h.headingNext) : h.headingDone}
          </h1>

          {focus && <PathHorizon steps={pathFor(focus.status, h.pathSteps)} text={h.pathState} className="mt-8" />}

          {next && (
            <PrimaryCard className="mt-8 p-6 sm:p-8">
              <p className="text-mono-label text-muted">{next.status === "in_progress" ? h.labelInProgress : h.labelUpNext}</p>
              <h2 className="mt-2 text-headline text-foreground">{next.assessments?.title}</h2>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="clock" className="w-4 h-4" />
                  {fillText(h.minutes, { n: minutesOf(next) })}
                </span>
                <span>{h.savesAsYouGo}</span>
                {next.due_at && <span className="font-semibold text-foreground">{dueLabelIn(lang, t.dates, next.due_at)}</span>}
              </p>
              <div className="mt-6">
                <ButtonLink href={`/candidate/assessments/${next.id}`} size="lg">
                  {next.status === "in_progress" ? h.continueAssessment : h.startAssessment}
                  <Icon name="arrowRight" className="w-4 h-4 ml-2" />
                </ButtonLink>
              </div>
            </PrimaryCard>
          )}

          <section aria-label={h.quickLinks} className="mt-10">
            <HomeLauncher
              label={h.quickLinks}
              tiles={[
                {
                  href: "/candidate/assessments",
                  title: h.testsTitle,
                  body: h.testsBody,
                  icon: "clipboard",
                  count: list.filter((a) => ["invited", "in_progress"].includes(a.status)).length,
                  countLabel: h.toDo,
                },
                {
                  href: "/candidate/results",
                  title: h.resultsTitle,
                  body: h.resultsBody,
                  icon: "award",
                  count: list.filter((a) => a.status === "reviewed").length,
                  countLabel: h.ready,
                },
                { href: "/privacy", title: h.privacyTitle, body: h.privacyBody, icon: "shield" },
              ]}
            />
          </section>

          <section aria-labelledby="mine-h" className="mt-12">
            <div className="flex items-baseline justify-between">
              <h2 id="mine-h" className="text-title-large text-foreground">
                {h.yourAssessments}
              </h2>
              <Link href="/candidate/assessments" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
                {h.viewAll}
              </Link>
            </div>
            <div className="mt-3 border-t border-line">
              {list.slice(0, 4).map((a) => (
                <ListRow
                  key={a.id}
                  href={a.status === "reviewed" ? `/candidate/results/${a.id}` : ["invited", "in_progress"].includes(a.status) ? `/candidate/assessments/${a.id}` : undefined}
                  trailing={<StatusBadge status={a.status} audience="candidate" labels={t.candidate.status} />}
                >
                  <p className="truncate text-base font-semibold text-foreground">{a.assessments?.title}</p>
                  <p className="text-sm text-muted">
                    {fillText(h.minInvited, { n: minutesOf(a), date: formatDateIn(lang, a.invited_at) })}
                  </p>
                </ListRow>
              ))}
            </div>
          </section>

          <section aria-labelledby="know-h" className="mt-12 rounded-card bg-surface-sunken p-6">
            <h2 id="know-h" className="text-title text-foreground">
              {h.knowTitle}
            </h2>
            <ul className="mt-3 space-y-2 text-base text-muted">
              {h.know.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
