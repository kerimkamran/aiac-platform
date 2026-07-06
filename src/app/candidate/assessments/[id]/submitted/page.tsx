import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, Icon } from "@/components/ui";
import { ConfettiBurst, SubmissionSeal } from "@/components/celebration";

const NEXT_STEPS = [
  { icon: "wand", title: "AI scoring", body: "Your responses are scored against the role's competency model within moments." },
  { icon: "eye", title: "Human review", body: "A recruiter reviews the AI-assisted scores alongside your answers before any decision is made." },
  { icon: "mail", title: "You'll hear back", body: "You'll be notified here once a decision maker has reviewed your results." },
] as const;

export default async function AssessmentSubmittedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: ca } = await supabase
    .from("candidate_assessments")
    .select("id, status, candidate_id, assessments(title)")
    .eq("id", id)
    .eq("candidate_id", user.id)
    .single();

  if (!ca) notFound();

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const firstName = (profile?.full_name || "").split(/\s+/)[0] || "there";
  const assessment = ca.assessments as unknown as { title: string } | null;

  return (
    <div className="p-6 lg:p-10 max-w-xl mx-auto">
      <div className="relative">
        <ConfettiBurst />
        <div className="relative flex flex-col items-center text-center pt-6 pb-2">
          <SubmissionSeal />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-3 [font-family:var(--font-display)]">
            You did it, {firstName}!
          </h1>
          <p className="text-sm text-muted mt-2.5 max-w-sm">
            <span className="font-semibold text-foreground">{assessment?.title}</span> has been submitted — nice
            work seeing that through to the end.
          </p>
        </div>
      </div>

      <Card className="p-6 mt-6 anim-fade-up delay-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-faint mb-4">What happens next</p>
        <div className="space-y-4">
          {NEXT_STEPS.map((s, i) => (
            <div key={s.title} className="flex items-start gap-3.5">
              <span className="w-8 h-8 rounded-xl bg-accent-soft text-accent-dark grid place-items-center shrink-0">
                <Icon name={s.icon} className="w-4 h-4" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-foreground">
                  {i + 1}. {s.title}
                </p>
                <p className="text-xs text-muted mt-0.5">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-3 mt-7 anim-fade-up delay-3">
        <Link
          href="/candidate/assessments"
          className="inline-flex items-center gap-2 bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-light transition-colors"
        >
          Back to my assessments
          <Icon name="arrowRight" className="w-4 h-4" />
        </Link>
        <Link
          href="/candidate"
          className="inline-flex items-center gap-2 border border-line text-sm font-semibold px-5 py-2.5 rounded-xl text-foreground hover:border-brand transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
