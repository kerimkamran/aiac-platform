import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScoutLauncher } from "@/components/ScoutLauncher";

// Design-execution-plan follow-up ("make it simple like Google"): the
// marketing homepage used to run six sections deep (hero, stat strip,
// how-it-works, framework breakdown, platform feature list, second CTA)
// before the footer. Replaced with a single, almost-empty screen -- a
// centered mark, one line of mission copy, and exactly two actions --
// on the theory that a page selling "evidence over gut feeling, one clear
// decision at a time" should look like one itself. Everything the six
// sections used to explain (how scoring works, the competency framework,
// the portal list) still exists in the product; it's just no longer
// something a visitor has to read before they can click anything.
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
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-end gap-6 px-6 py-5 text-xs">
        <Link href="/login" className="font-medium text-muted hover:text-foreground transition-colors">
          Log in
        </Link>
        <Link href="/signup" className="font-medium text-muted hover:text-foreground transition-colors">
          Candidate sign-up
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 -mt-14">
        <LogoMark className="w-14 h-14 mb-7" />
        <h1 className="text-display font-semibold tracking-tight text-foreground text-center leading-tight [font-family:var(--font-display)]">
          Vantage
        </h1>
        <p className="text-sm text-muted text-center mt-3 max-w-sm leading-relaxed">
          Decide on evidence, not gut feeling. Structured assessments, AI-assisted scoring, human-confirmed decisions.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-9">
          <Link
            href="/login"
            className="inline-flex items-center px-6 py-2.5 rounded-md bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            HR / Staff login
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center px-6 py-2.5 rounded-md border border-line text-foreground font-semibold text-sm hover:border-line-strong/50 transition-colors"
          >
            I&apos;m a candidate
          </Link>
        </div>
      </main>

      <footer className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-4 px-6 py-6 text-2xs text-muted text-center">
        <span>Azerconnect Group — Internal Use Only</span>
        <span className="hidden md:inline">·</span>
        <span className="flex items-center gap-4">
          <ThemeToggle className="text-muted hover:text-muted transition-colors" />
          
            href="https://www.linkedin.com/in/thekmrnkrml/"
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-muted transition-colors whitespace-nowrap"
          >
            Developed by Kamran Karimli
          </a>
        </span>
      </footer>

      <ScoutLauncher role="visitor" />
    </div>
  );
}
