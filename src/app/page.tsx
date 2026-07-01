import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role === "candidate") redirect("/candidate");
    if (profile) redirect("/staff");
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-brand text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-semibold tracking-tight">AI Assessment Center <span className="text-accent">by AG</span></div>
          <nav className="flex gap-3 text-sm">
            <Link href="/login" className="px-4 py-2 rounded-md hover:bg-white/10">Log in</Link>
            <Link href="/signup" className="px-4 py-2 rounded-md bg-accent hover:opacity-90 font-medium">Get started</Link>
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-b from-brand to-brand-light text-white">
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <p className="uppercase tracking-widest text-accent text-xs font-semibold mb-4">Azerconnect Group</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Competency-based hiring, powered by AI
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-10">
            A unified platform for competency-driven assessments, candidate evaluation, and
            evidence-based hiring decisions — built on Azerconnect&apos;s governed 37-competency
            framework.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/signup" className="px-6 py-3 rounded-md bg-accent font-semibold hover:opacity-90">
              Candidate sign up
            </Link>
            <Link href="/login" className="px-6 py-3 rounded-md border border-white/40 font-semibold hover:bg-white/10">
              Recruiter / HR login
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8 flex-1">
        <Feature
          title="Candidate Portal"
          body="Candidates take structured, competency-mapped assessments — MCQ, scenario, and open-response — in a guided, mobile-friendly flow."
        />
        <Feature
          title="Assessment Builder"
          body="HR admins compose assessments from the governed competency library, mapping every question to a Core, Leadership, or Functional competency."
        />
        <Feature
          title="Recruiter & Hiring Manager Portal"
          body="Reviewers see per-competency scores, AI-generated rationale, and can shortlist or reject with full evidence traceability."
        />
      </section>

      <footer className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-gray-500 flex justify-between">
          <span>Azerconnect Group — Internal Use Only</span>
          <span>AIAC Platform v1.0 (Phase 1 MVP)</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-6 rounded-lg border bg-white shadow-sm">
      <h3 className="font-semibold text-brand mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
    </div>
  );
}
