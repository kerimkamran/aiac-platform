import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Icon, Logo, LogoMark } from "@/components/ui";

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
      <header className="sticky top-0 z-40 backdrop-blur-md bg-brand-deep/85 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Logo dark />
          <nav className="hidden md:flex items-center gap-7 text-[13.5px] font-medium text-white/70">
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#framework" className="hover:text-white transition-colors">Competency framework</a>
            <a href="#features" className="hover:text-white transition-colors">Platform</a>
          </nav>
          <div className="flex items-center gap-2.5 text-sm">
            <Link href="/login" className="px-4 py-2 rounded-xl text-white/85 font-medium hover:bg-white/10 transition-colors">
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-xl bg-accent text-white font-semibold hover:bg-accent-dark transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative hero-mesh text-white overflow-hidden">
        <div className="absolute inset-0 hero-grid-overlay" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20 lg:pt-32 lg:pb-28">
          <div className="max-w-3xl">
            <p className="anim-fade-up inline-flex items-center gap-2 text-[12px] font-semibold text-accent bg-accent/10 ring-1 ring-inset ring-accent/30 rounded-full px-3.5 py-1.5 mb-6">
              <Icon name="sparkles" className="w-3.5 h-3.5" />
              Azerconnect Group · AI Assessment Center
            </p>
            <h1 className="anim-fade-up delay-1 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] [font-family:var(--font-display)]">
              Hire on evidence,
              <br />
              not <span className="text-gradient">gut feeling.</span>
            </h1>
            <p className="anim-fade-up delay-2 text-lg text-white/70 max-w-xl mt-6 leading-relaxed">
              AIAC turns Azerconnect&apos;s governed 37-competency framework into structured assessments,
              AI-assisted scoring, and reviewer-verified hiring decisions — every score traceable back to
              a candidate&apos;s own words.
            </p>
            <div className="anim-fade-up delay-3 flex flex-wrap gap-3.5 mt-9">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-accent font-semibold hover:bg-accent-dark transition-colors shadow-lg shadow-accent/25"
              >
                I&apos;m a candidate
                <Icon name="arrowRight" className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/25 font-semibold hover:bg-white/10 transition-colors"
              >
                Recruiter / HR login
              </Link>
            </div>
          </div>

          {/* Floating product preview */}
          <div className="anim-fade-up delay-4 mt-16 lg:mt-20">
            <HeroPreview />
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/10 bg-black/15">
          <div className="max-w-6xl mx-auto px-6 py-7 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              ["37", "governed competencies"],
              ["3", "competency categories"],
              ["4", "proficiency bands"],
              ["100%", "decisions with evidence"],
            ].map(([v, l], i) => (
              <div key={l} className={`anim-fade-up delay-${i + 2}`}>
                <p className="text-3xl font-bold [font-family:var(--font-display)] text-white">{v}</p>
                <p className="text-[12.5px] text-white/55 mt-1">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-24 w-full">
        <SectionHead
          eyebrow="How it works"
          title="From competency library to hiring decision"
          body="One governed loop — build, assess, decide — with a human reviewer confirming every AI-assisted score."
        />
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {[
            {
              icon: "layers",
              step: "01 · Build",
              title: "Compose from the framework",
              body: "HR admins assemble assessments section by section, mapping every question to one of the 37 governed competencies — MCQ, scenario, or open response.",
            },
            {
              icon: "brain",
              step: "02 · Assess",
              title: "Candidates respond, AI scores",
              body: "Candidates work through a guided, timed flow. Each answer is scored against the competency's behavioural anchors, with a written rationale for every score.",
            },
            {
              icon: "shield",
              step: "03 · Decide",
              title: "Humans confirm, evidence stays",
              body: "Recruiters review the competency profile, read the evidence behind each score, and shortlist, hold, or reject — the full trail is preserved.",
            },
          ].map((s, i) => (
            <div key={s.step} className="relative bg-surface border border-line rounded-2xl p-7 shadow-sm">
              <span className="absolute -top-3 left-7 text-[11px] font-bold tracking-widest uppercase text-accent-dark bg-accent-soft rounded-full px-3 py-1">
                {s.step}
              </span>
              <span className="w-11 h-11 rounded-xl bg-brand/8 text-brand grid place-items-center mb-5 mt-2">
                <Icon name={s.icon} className="w-5.5 h-5.5" />
              </span>
              <h3 className="font-bold text-foreground text-lg [font-family:var(--font-display)]">{s.title}</h3>
              <p className="text-sm text-muted leading-relaxed mt-2.5">{s.body}</p>
              {i < 2 && (
                <Icon
                  name="arrowRight"
                  className="hidden md:block absolute top-1/2 -right-4.5 w-5 h-5 text-faint z-10"
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Competency framework ---------- */}
      <section id="framework" className="bg-brand-deep text-white py-24">
        <div className="max-w-6xl mx-auto px-6">
          <SectionHead
            dark
            eyebrow="The competency model"
            title="One governed framework. 37 competencies."
            body="Every question, score, and decision on the platform maps back to Azerconnect's competency dictionary — organised into three categories, measured on four proficiency bands."
          />
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <FrameworkCard
              color="#1050a8"
              name="Core · 4"
              blurb="The mandatory behaviours every Azerconnect employee is measured on, with Basic / Skilled / Expert behavioural indicators."
              samples={["Innovating", "Collaborative", "Leading Through Change", "Resourcefulness"]}
              full
            />
            <FrameworkCard
              color="#b9861a"
              name="Leadership · 2"
              blurb="What we expect from people who set direction — inspiring others and driving a clear, compelling vision of the future."
              samples={["Engages & Inspires", "Drives Vision & Purpose"]}
              full
            />
            <FrameworkCard
              color="#3a8820"
              name="Functional · 31"
              blurb="Role-specific depth — from business acumen to data-driven decision making — assessed with the same rigour as behaviour."
              samples={["Business Acumen", "Strategic Thinking", "Customer Centricity", "Data-Driven Decision Making", "Effective Communication"]}
            />
          </div>

          {/* Proficiency bands */}
          <div className="mt-14 bg-white/5 border border-white/10 rounded-2xl p-7">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45 mb-5">
              Four proficiency bands, one shared language
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ["Does Not Meet", "0–49", "#c62020"],
                ["Partially Meets", "50–69", "#a06a00"],
                ["Fully Meets", "70–84", "#3a8820"],
                ["Exceeds", "85–100", "#2d6b16"],
              ].map(([label, range, color]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-2.5 h-9 rounded-full shrink-0" style={{ background: color as string }} />
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-white/45 tabular-nums">{range}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24 w-full">
        <SectionHead
          eyebrow="The platform"
          title="Everything the hiring loop needs, in one place"
          body="Purpose-built portals for candidates, recruiters, hiring managers, and HR admins."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {[
            ["clipboard", "Guided assessment flow", "One question at a time, live timer, progress tracking, and automatic draft saving — candidates focus on answers, not the interface."],
            ["wand", "AI-assisted scoring", "Every response is scored against competency anchors with a written rationale. Low-confidence scores are flagged for human review."],
            ["chart", "Talent analytics", "Score distributions, pipeline funnels, and per-competency radar profiles turn assessment data into hiring insight."],
            ["target", "Competency mapping", "Sections and questions bind to the governed dictionary, so results roll up into a comparable competency profile per candidate."],
            ["shield", "Human-in-the-loop", "AI proposes, people decide. Reviewers confirm scores and record shortlist / hold / reject decisions with full audit history."],
            ["file", "Printable reports", "Every candidate profile exports as a clean, print-ready competency report for panel discussions."],
          ].map(([icon, title, body]) => (
            <div key={title} className="bg-surface border border-line rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-accent/40 transition-all">
              <span className="w-10 h-10 rounded-xl bg-accent-soft text-accent-dark grid place-items-center mb-4">
                <Icon name={icon} className="w-5 h-5" />
              </span>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="text-[13.5px] text-muted leading-relaxed mt-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="max-w-6xl mx-auto px-6 pb-24 w-full">
        <div className="relative overflow-hidden hero-mesh rounded-3xl text-white px-8 py-14 md:px-14 text-center">
          <div className="absolute inset-0 hero-grid-overlay" aria-hidden />
          <div className="relative">
            <LogoMark className="w-12 h-12 mx-auto mb-6 anim-float" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight [font-family:var(--font-display)]">
              Ready to see the full picture of every candidate?
            </h2>
            <p className="text-white/65 max-w-xl mx-auto mt-4">
              Candidates sign up and complete their invited assessments. Recruiters and HR admins log in to
              build, review, and decide.
            </p>
            <div className="flex flex-wrap justify-center gap-3.5 mt-8">
              <Link href="/signup" className="px-6 py-3 rounded-xl bg-accent font-semibold hover:bg-accent-dark transition-colors">
                Create candidate account
              </Link>
              <Link href="/login" className="px-6 py-3 rounded-xl border border-white/25 font-semibold hover:bg-white/10 transition-colors">
                Staff login
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-line bg-surface mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo />
          <p className="text-[12.5px] text-faint text-center">
            Azerconnect Group — Internal Use Only · AIAC Platform v1.0 · Phase 1 scoring is simulated; the
            production LLM engine ships per SRS Part 4.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ---------- helpers ---------- */

function SectionHead({ eyebrow, title, body, dark = false }: { eyebrow: string; title: string; body: string; dark?: boolean }) {
  return (
    <div className="max-w-2xl">
      <p className={`text-[12px] font-bold uppercase tracking-[0.18em] ${dark ? "text-accent" : "text-accent-dark"}`}>{eyebrow}</p>
      <h2 className={`text-3xl md:text-4xl font-bold tracking-tight mt-3 [font-family:var(--font-display)] ${dark ? "text-white" : "text-foreground"}`}>
        {title}
      </h2>
      <p className={`mt-4 leading-relaxed ${dark ? "text-white/60" : "text-muted"}`}>{body}</p>
    </div>
  );
}

function FrameworkCard({
  color,
  name,
  blurb,
  samples,
  full = false,
}: {
  color: string;
  name: string;
  blurb: string;
  samples: string[];
  full?: boolean;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-7 hover:bg-white/[0.08] transition-colors">
      <span className="inline-flex items-center gap-2 text-sm font-bold" style={{ color }}>
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        {name}
      </span>
      <p className="text-sm text-white/60 leading-relaxed mt-3">{blurb}</p>
      <ul className="mt-5 space-y-2">
        {samples.map((s) => (
          <li key={s} className="flex items-center gap-2.5 text-[13px] text-white/80">
            <Icon name="check" className="w-3.5 h-3.5 shrink-0" />
            {s}
          </li>
        ))}
        {!full && <li className="text-[12px] text-white/40 pl-6">…and more in the governed dictionary</li>}
      </ul>
    </div>
  );
}

/* A stylised, hand-built product mock — no screenshots needed. */
function HeroPreview() {
  const bars = [
    ["Innovating", 88, "Core"],
    ["Engages & Inspires", 76, "Leadership"],
    ["Data-Driven Decision Making", 91, "Functional"],
    ["Collaborative", 64, "Core"],
  ] as const;
  const catColor: Record<string, string> = { Core: "#1050a8", Leadership: "#b9861a", Functional: "#3a8820" };
  return (
    <div className="bg-white/[0.06] backdrop-blur border border-white/15 rounded-2xl p-2 shadow-2xl shadow-black/30 max-w-4xl">
      <div className="bg-surface rounded-xl overflow-hidden text-foreground">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-line bg-background/60">
          <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
          <span className="ml-3 text-[11px] text-faint font-medium">aiac.azerconnect.az / staff / candidates / leyla-mammadova</span>
        </div>
        <div className="grid md:grid-cols-[1fr_1.6fr] gap-6 p-6">
          <div className="flex flex-col items-center justify-center gap-3 border border-line rounded-xl p-5 bg-background/40">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-faint">Overall Role Fit</p>
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line)" strokeWidth="9" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="#2d6b16" strokeWidth="9" strokeLinecap="round" strokeDasharray="264" strokeDashoffset="55" />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-3xl font-bold rotate-0">79</span>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
              Fully Meets
            </span>
          </div>
          <div className="space-y-4 self-center">
            {bars.map(([label, v, cat]) => (
              <div key={label}>
                <div className="flex items-center justify-between text-[12px] mb-1.5">
                  <span className="font-medium text-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: catColor[cat] }} />
                    {label}
                  </span>
                  <span className="font-bold tabular-nums">{v}</span>
                </div>
                <div className="h-2 rounded-full bg-line/70 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${v}%`, background: catColor[cat] }} />
                </div>
              </div>
            ))}
            <p className="text-[11px] text-faint pt-1">
              AI rationale attached to every score · confirmed by a human reviewer
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
