import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Icon, Logo } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScoutLauncher } from "@/components/ScoutLauncher";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role === "candidate") redirect("/candidate");
    if (profile) redirect("/staff");
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 bg-surface border-b border-line">
        <div className="max-w-[1180px] mx-auto px-6 h-14 flex items-center justify-between">
          <Logo compact />
          <nav className="hidden md:flex items-center gap-6 text-[13px] text-muted">
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#framework" className="hover:text-foreground transition-colors">Competency framework</a>
            <a href="#platform" className="hover:text-foreground transition-colors">Platform</a>
          </nav>
          <div className="flex items-center gap-4 text-[13px]">
            <Link href="/login" className="font-medium text-muted hover:text-foreground transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="font-semibold text-background bg-foreground px-3.5 py-1.5 rounded-md hover:opacity-90 transition-opacity">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="max-w-[1180px] mx-auto px-6 pt-20 pb-16 w-full">
        <div className="max-w-2xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent mb-5">
            Azerconnect Group — Vantage
          </p>
          <h1 className="text-[40px] md:text-[52px] font-semibold tracking-tight leading-[1.08] text-foreground">
            Decide on evidence, not gut feeling.
          </h1>
          <p className="text-[16px] text-muted max-w-xl mt-6 leading-relaxed">
            Vantage turns Azerconnect&apos;s governed 37-competency framework into structured assessments,
            AI-assisted scoring, and reviewer-verified decisions — for hiring, promotion, or development —
            every score traceable back to a person&apos;s own words.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-foreground text-background font-semibold text-[13.5px] hover:opacity-90 transition-opacity"
            >
              I&apos;m a candidate
              <Icon name="arrowRight" className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center px-5 py-2.5 rounded-md border border-line text-foreground font-semibold text-[13.5px] hover:border-faint/50 transition-colors"
            >
              HR / Staff login
            </Link>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 pt-10 border-t border-line">
          {[
            ["37", "governed competencies"],
            ["3", "competency categories"],
            ["4", "proficiency bands"],
            ["100%", "decisions with evidence"],
          ].map(([v, l]) => (
            <div key={l}>
              <p className="text-[30px] font-semibold tracking-tight text-foreground tabular-nums">{v}</p>
              <p className="text-[12.5px] text-faint mt-1">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="max-w-[1180px] mx-auto px-6 py-16 w-full border-t border-line">
        <SectionHead
          eyebrow="How it works"
          title="From competency library to hiring decision"
          body="One governed loop — build, assess, decide — with a human reviewer confirming every AI-assisted score."
        />
        <div className="grid md:grid-cols-3 gap-x-10 gap-y-10 mt-12">
          {[
            {
              step: "01",
              title: "Build — compose from the framework",
              body: "HR admins assemble assessments section by section, mapping every question to one of the 37 governed competencies — MCQ, scenario, or open response.",
            },
            {
              step: "02",
              title: "Assess — candidates respond, AI scores",
              body: "Candidates work through a guided, timed flow. Each answer is scored against the competency's behavioural anchors, with a written rationale for every score.",
            },
            {
              step: "03",
              title: "Decide — humans confirm, evidence stays",
              body: "Recruiters review the competency profile, read the evidence behind each score, and shortlist, hold, or reject — the full trail is preserved.",
            },
          ].map((s) => (
            <div key={s.step}>
              <p className="text-[13px] font-semibold text-faint tabular-nums mb-3">{s.step}</p>
              <h3 className="font-semibold text-foreground text-[15px]">{s.title}</h3>
              <p className="text-[13.5px] text-muted leading-relaxed mt-2">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Competency framework ---------- */}
      <section id="framework" className="border-t border-line bg-surface">
        <div className="max-w-[1180px] mx-auto px-6 py-16">
          <SectionHead
            eyebrow="The competency model"
            title="One governed framework. 37 competencies."
            body="Every question, score, and decision on the platform maps back to Azerconnect's competency dictionary — organised into three categories, measured on four proficiency bands."
          />

          <div className="grid md:grid-cols-3 gap-x-10 gap-y-8 mt-12 pb-12 border-b border-line">
            <FrameworkColumn
              name="Core"
              count={4}
              blurb="The mandatory behaviours every Azerconnect employee is measured on, with Basic / Skilled / Expert behavioural indicators."
              samples={["Innovating", "Collaborative", "Leading Through Change", "Resourcefulness"]}
              full
            />
            <FrameworkColumn
              name="Leadership"
              count={2}
              blurb="What we expect from people who set direction — inspiring others and driving a clear, compelling vision of the future."
              samples={["Engages & Inspires", "Drives Vision & Purpose"]}
              full
            />
            <FrameworkColumn
              name="Functional"
              count={31}
              blurb="Role-specific depth — from business acumen to data-driven decision making — assessed with the same rigour as behaviour."
              samples={["Business Acumen", "Strategic Thinking", "Customer Centricity", "Data-Driven Decision Making", "Effective Communication"]}
            />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint mt-12 mb-5">
            Four proficiency bands, one shared language
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              ["Does Not Meet", "0–49"],
              ["Partially Meets", "50–69"],
              ["Fully Meets", "70–84"],
              ["Exceeds", "85–100"],
            ].map(([label, range]) => (
              <div key={label}>
                <p className="text-[13.5px] font-semibold text-foreground">{label}</p>
                <p className="text-[12px] text-faint tabular-nums mt-0.5">{range}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Platform ---------- */}
      <section id="platform" className="max-w-[1180px] mx-auto px-6 py-16 w-full">
        <SectionHead
          eyebrow="The platform"
          title="Everything the hiring loop needs, in one place"
          body="Purpose-built portals for candidates, recruiters, hiring managers, and HR admins."
        />
        <div className="mt-10 border-t border-line">
          {[
            ["Guided assessment flow", "One question at a time, live timer, progress tracking, and automatic draft saving — candidates focus on answers, not the interface."],
            ["AI-assisted scoring", "Every response is scored against competency anchors with a written rationale. Low-confidence scores are flagged for human review."],
            ["Talent analytics", "Score distributions, pipeline funnels, and per-competency profiles turn assessment data into hiring insight."],
            ["Competency mapping", "Sections and questions bind to the governed dictionary, so results roll up into a comparable competency profile per candidate."],
            ["Human-in-the-loop", "AI proposes, people decide. Reviewers confirm scores and record shortlist / hold / reject decisions with full audit history."],
            ["Printable reports", "Every candidate profile exports as a clean, print-ready competency report for panel discussions."],
          ].map(([title, body]) => (
            <div key={title} className="grid md:grid-cols-[280px_1fr] gap-4 py-6 border-b border-line">
              <h3 className="font-semibold text-foreground text-[14.5px]">{title}</h3>
              <p className="text-[13.5px] text-muted leading-relaxed max-w-xl">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="border-t border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-16 flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-lg">
            <h2 className="text-[26px] font-semibold tracking-tight text-foreground">
              Ready to see the full picture of every candidate?
            </h2>
            <p className="text-[13.5px] text-muted mt-3 leading-relaxed">
              Candidates sign up and complete their invited assessments. Recruiters and HR admins log in to
              build, review, and decide.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="px-5 py-2.5 rounded-md bg-foreground text-background font-semibold text-[13.5px] hover:opacity-90 transition-opacity">
              Create candidate account
            </Link>
            <Link href="/login" className="px-5 py-2.5 rounded-md border border-line text-foreground font-semibold text-[13.5px] hover:border-faint/50 transition-colors">
              Staff login
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-line mt-auto">
        <div className="max-w-[1180px] mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <span className="text-[11.5px] text-faint">
            Azerconnect Group — Internal Use Only · Vantage v1.0 · Phase 1 scoring is simulated; the production
            LLM engine ships per SRS Part 4.
          </span>
          <div className="flex items-center gap-4">
            <ThemeToggle className="text-[11.5px] text-faint hover:text-muted transition-colors" />
            <a
              href="https://www.linkedin.com/in/thekmrnkrml/"
              target="_blank"
              rel="noreferrer"
              className="text-[11.5px] text-faint hover:text-muted transition-colors whitespace-nowrap"
            >
              Developed by Kamran Karimli
            </a>
          </div>
        </div>
      </footer>

      <ScoutLauncher role="visitor" />
    </div>
  );
}

/* ---------- helpers ---------- */

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
      <h2 className="text-[26px] font-semibold tracking-tight mt-2.5 text-foreground">{title}</h2>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function FrameworkColumn({
  name,
  count,
  blurb,
  samples,
  full = false,
}: {
  name: string;
  count: number;
  blurb: string;
  samples: string[];
  full?: boolean;
}) {
  return (
    <div>
      <p className="text-[14px] font-semibold text-foreground">
        {name} <span className="text-faint font-normal tabular-nums">· {count}</span>
      </p>
      <p className="text-[13px] text-muted leading-relaxed mt-2">{blurb}</p>
      <ul className="mt-4 space-y-1.5">
        {samples.map((s) => (
          <li key={s} className="text-[12.5px] text-muted flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-faint shrink-0" />
            {s}
          </li>
        ))}
        {!full && <li className="text-[11.5px] text-faint pl-3">and more in the governed dictionary</li>}
      </ul>
    </div>
  );
}
