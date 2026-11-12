import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Avatar, ScoreBadge, StatusBadge } from "@/components/ui";
import { ButtonLink } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/Surfaces";
import { FocusDeck } from "@/components/horizon/FocusDeck";
import { ageLabel } from "@/lib/dates";

export const metadata = { title: "Your decisions" };

type Row = {
  candidate_assessment_id: string;
  assigned_at: string;
  candidate_assessments: {
    id: string;
    status: string;
    overall_score: number | null;
    candidate: { full_name: string; email: string } | null;
    assessments: { title: string; vacancy_title: string | null } | null;
  } | null;
};

// Decision deck (Clear Horizon plan, section 10): the candidates waiting for
// *your* decision, one at a time, then the ones you have already decided. The
// position is in the URL (?i=).
export default async function DecisionHomePage({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const { i } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assignments } = await supabase
    .from("candidate_decision_makers")
    .select(
      "candidate_assessment_id, assigned_at, candidate_assessments(id, status, overall_score, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email), assessments(title, vacancy_title))"
    )
    .eq("profile_id", user.id)
    .order("assigned_at", { ascending: true });

  const rows = ((assignments || []) as unknown as Row[]).filter((r) => r.candidate_assessments);
  const ids = rows.map((r) => r.candidate_assessment_id);
  const { data: myReviews } = ids.length
    ? await supabase.from("candidate_reviews").select("candidate_assessment_id").eq("reviewer_id", user.id).in("candidate_assessment_id", ids)
    : { data: [] as { candidate_assessment_id: string }[] };
  const decided = new Set((myReviews || []).map((r) => r.candidate_assessment_id));

  const awaiting = rows.filter((r) => !decided.has(r.candidate_assessment_id));
  const done = rows.filter((r) => decided.has(r.candidate_assessment_id));

  const n = Number.parseInt(i ?? "0", 10);
  const index = Number.isFinite(n) && awaiting.length ? Math.min(Math.max(n, 0), awaiting.length - 1) : 0;
  const current = awaiting[index];
  const href = (k: number) => `/decision?i=${k}`;

  return (
    <div className="container-page max-w-3xl py-8 lg:py-12">
      <h1 className="text-display text-foreground measure">
        {awaiting.length === 0
          ? rows.length === 0
            ? "Nothing has been assigned to you yet."
            : "You have decided on everyone."
          : awaiting.length === 1
            ? "1 candidate is waiting for your decision."
            : `${awaiting.length} candidates are waiting for your decision.`}
      </h1>
      {rows.length === 0 && <p className="mt-3 text-body-large text-muted measure">HR will assign candidates to you from a candidate&apos;s review page.</p>}

      {current && (
        <div className="mt-8">
          <FocusDeck
            index={index}
            total={awaiting.length}
            title={current.candidate_assessments!.candidate?.full_name || "Candidate"}
            meta={`${current.candidate_assessments!.assessments?.vacancy_title || current.candidate_assessments!.assessments?.title || ""} · assigned ${ageLabel(current.assigned_at)} ago`.replace("today ago", "today")}
            openHref={`/decision/candidates/${current.candidate_assessments!.id}`}
            openLabel="Review and decide"
            prevHref={index > 0 ? href(index - 1) : undefined}
            nextHref={index < awaiting.length - 1 ? href(index + 1) : undefined}
          >
            <div className="flex items-center gap-3 text-base text-muted">
              <StatusBadge status={current.candidate_assessments!.status} />
              {current.candidate_assessments!.overall_score !== null && (
                <span>
                  Role fit <ScoreBadge score={Math.round(current.candidate_assessments!.overall_score)} />
                </span>
              )}
            </div>
          </FocusDeck>
        </div>
      )}

      {done.length > 0 && (
        <section aria-labelledby="done-h" className="mt-14">
          <h2 id="done-h" className="text-title-large text-foreground">
            Decided
          </h2>
          <div className="mt-3 border-t border-line">
            {done.map((r) => {
              const ca = r.candidate_assessments!;
              return (
                <ListRow key={ca.id} href={`/decision/candidates/${ca.id}`} trailing={<span className="text-sm font-semibold text-good">Submitted</span>}>
                  <div className="flex items-center gap-3">
                    <Avatar name={ca.candidate?.full_name || "?"} className="w-9 h-9 text-xs" />
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-foreground">{ca.candidate?.full_name}</p>
                      <p className="truncate text-sm text-muted">{ca.assessments?.vacancy_title || ca.assessments?.title}</p>
                    </div>
                  </div>
                </ListRow>
              );
            })}
          </div>
        </section>
      )}

      {awaiting.length === 0 && rows.length > 0 && (
        <div className="mt-6">
          <ButtonLink href="/decision" variant="secondary">
            Refresh
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
