import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Timeline } from "@/components/ui/Timeline";
import { HorizonSeal } from "@/components/horizon/HorizonSeal";
import { AssessmentPurpose, normalizePurpose } from "@/lib/purpose";

// What happens next, in plain language. A person reviews every score, and a
// candidate is never told "AI scored" (Clear Horizon plan, section 11).
const NEXT_STEPS: Record<AssessmentPurpose, { t: string; b: string }[]> = {
  hiring: [
    { t: "A draft is prepared", b: "Your answers are compared with the role's competencies, with the evidence noted." },
    { t: "A person reviews it", b: "A recruiter checks the draft against your answers before anything is decided." },
    { t: "You'll hear back", b: "You'll be notified here once a decision maker has reviewed your results." },
  ],
  promotion: [
    { t: "A draft is prepared", b: "Your answers are compared with the target role's competencies, with the evidence noted." },
    { t: "Your manager and HR review it", b: "They check the draft against your answers before any outcome is decided." },
    { t: "You'll hear back", b: "You'll be notified here once your promotion review is complete." },
  ],
  development: [
    { t: "A draft is prepared", b: "Your answers are compared with the competency model, with the evidence noted." },
    { t: "A reviewer gives feedback", b: "A person looks at the draft alongside your answers to identify strengths and growth areas." },
    { t: "You'll hear back", b: "You'll be notified here when your feedback is ready. There is no pass or fail." },
  ],
};

export default async function AssessmentSubmittedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reason?: string }>;
}) {
  const { id } = await params;
  const { reason } = await searchParams;
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

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const firstName = (profile?.full_name || "").split(/\s+/)[0] || "there";
  const assessment = ca.assessments as unknown as { title: string; purpose: string | null } | null;
  const purpose = normalizePurpose(assessment?.purpose);
  const nextSteps = NEXT_STEPS[purpose];

  return (
    <div className="container-page max-w-xl py-10 lg:py-14">
      <div className="flex flex-col items-center text-center">
        <HorizonSeal />
        <h1 className="mt-5 text-display text-foreground">{expired ? "Time ran out. Your answers are in." : `Your answers are in, ${firstName}.`}</h1>
        <p className="mt-3 text-body-large text-muted measure">
          {expired ? (
            <>
              The timer ended, so <span className="font-semibold text-foreground">{assessment?.title}</span> was submitted automatically with the answers you had. There is nothing more to do.
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground">{assessment?.title}</span> has been submitted. Thank you for seeing it through.
            </>
          )}
        </p>
      </div>

      <section className="mt-10 border-t border-line pt-6 anim-fade-up">
        <h2 className="text-title-large text-foreground">What happens next</h2>
        <Timeline
          className="mt-5"
          steps={nextSteps.map((s, i) => ({ label: s.t, detail: s.b, state: i === 0 ? "current" : "todo" }))}
        />
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/candidate" size="lg">
          Go to my home
        </ButtonLink>
        <ButtonLink href="/candidate/assessments" variant="secondary" size="lg">
          My assessments
        </ButtonLink>
      </div>
    </div>
  );
}
