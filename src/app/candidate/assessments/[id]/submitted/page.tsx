import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Timeline } from "@/components/ui/Timeline";
import { VantageMark } from "@/components/VantageMark";
import { AssessmentPurpose, normalizePurpose } from "@/lib/purpose";
import { ClearDraft } from "../ClearDraft";
import { getT } from "@/i18n/server";
import { fillNodes } from "@/lib/fill-nodes";
import { fillText } from "@/lib/dates";

// What happens next, in plain language (the steps live in the dictionaries). A
// person reviews every score, and a candidate is never told "AI scored" (Clear
// Horizon plan, section 11).

export default async function AssessmentSubmittedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reason?: string }>;
}) {
  const { id } = await params;
  const { reason } = await searchParams;
  const { t } = await getT();
  const w = t.candidate.submitted;
  // Design-execution-plan Phase 6 / T6.4: a submission the countdown forced
  // through at zero gets a calm, neutral confirmation -- never the "you did
  // it!" framing meant for someone who chose to submit.
  const expired = reason === "expiry";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select("id, status, candidate_id, assessments(title, purpose)")
    .eq("id", id)
    .eq("candidate_id", user.id)
    .single();

  if (!ca) notFound();
  // Someone who has not submitted yet is sent back to the test, not shown a confirmation (CAN-B-31).
  if (["invited", "in_progress"].includes(ca.status)) redirect(`/candidate/assessments/${id}`);

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const firstName = (profile?.full_name || "").split(/\s+/)[0] || "";
  const assessment = ca.assessments as unknown as { title: string; purpose: string | null } | null;
  const purpose = normalizePurpose(assessment?.purpose);
  const titleNode = <span className="font-semibold text-foreground">{assessment?.title}</span>;
  const nextSteps: { t: string; b: string }[] = w.steps[purpose as AssessmentPurpose];

  return (
    <div className="container-page max-w-xl py-10 lg:py-14">
      <ClearDraft caId={id} />
      <div className="flex flex-col items-center text-center">
        <VantageMark animate tile={false} className="w-20 h-20" title="Vantage" />
        <h1 className="mt-5 text-display text-foreground">{expired ? w.expiredTitle : firstName ? fillText(w.doneTitle, { name: firstName }) : w.doneTitleNoName}</h1>
        <p className="mt-3 text-body-large text-muted measure">
          {expired ? (
            fillNodes(w.expiredBody, { title: titleNode })
          ) : (
            fillNodes(w.doneBody, { title: titleNode })
          )}
        </p>
      </div>

      <section className="mt-10 border-t border-line pt-6">
        <h2 className="text-title-large text-foreground">{w.next}</h2>
        <Timeline
          className="mt-5"
          steps={nextSteps.map((s, i) => ({ label: s.t, detail: s.b, state: i === 0 ? "current" : "todo" }))}
        />
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/candidate" size="lg">
          {w.goHome}
        </ButtonLink>
        <ButtonLink href="/candidate/assessments" variant="secondary" size="lg">
          {w.myAssessments}
        </ButtonLink>
      </div>
    </div>
  );
}
