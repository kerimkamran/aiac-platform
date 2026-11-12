import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/home";
import { getT } from "@/i18n/server";
import { VantageMark } from "@/components/VantageMark";
import { AppearanceMenu } from "@/components/AppearanceMenu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HorizonField } from "@/components/horizon/HorizonField";
import { NodeField } from "@/components/horizon/NodeField";
import { ExamPreview } from "@/components/horizon/ExamPreview";
import { EvidenceCard } from "@/components/horizon/EvidenceCard";
import { LegalText } from "@/components/LegalText";
import { Fig } from "@/components/ui/Surfaces";
import { ButtonLink } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { login } from "@/app/login/actions";

// The public landing page, "See talent clearly." (Clear Horizon plan,
// section 9): sticky frosted bar, hero with the animated horizon and a sign-in
// card, three numbered sections, a navy closing band and a footer. Signed-in
// visitors never see it; they go straight to their own home. The page is
// server-rendered in the visitor's language; only the horizon animation and the
// language buttons run in the browser.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const dest = homeFor(profile?.role);
    if (dest !== "/login") redirect(dest);
  }

  const { lang, t } = await getT();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-foreground">
        {t.common.skip}
      </a>

      <header className="glass sticky top-0 z-40 border-b border-line-soft">
        <div className="container-page flex h-14 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 rounded-md" aria-label={t.common.appName}>
            <VantageMark className="w-8 h-8" />
            <span className="text-lg font-semibold tracking-tight text-foreground">{t.common.appName}</span>
            <span className="hidden md:inline text-sm text-muted pl-2.5 border-l border-line">{t.common.company}</span>
          </Link>
          <nav aria-label={t.nav.main} className="flex items-center gap-1">
            <a href="#teams" className="hidden md:inline-flex min-h-11 items-center px-3 rounded-md text-sm font-medium text-muted hover:text-foreground">
              {t.nav.howItWorks}
            </a>
            <LanguageSwitcher current={lang} label={t.common.language} />
            <AppearanceMenu />
            <ButtonLink href="/login" size="md" className="ml-1 hidden sm:inline-flex">
              {t.common.signIn}
            </ButtonLink>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {/* Hero */}
        <section className="container-page py-12 lg:py-20 grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <p className="text-mono-label text-muted">{t.hero.eyebrow}</p>
            <h1 className="mt-4 text-display-xl text-foreground">{t.hero.headline}</h1>
            <p className="mt-5 text-body-large text-muted measure">{t.hero.lead}</p>
            <div className="mt-7 flex flex-col gap-1">
              <a href="#candidates" className="inline-flex min-h-11 items-center text-base font-semibold text-accent hover:underline">
                {t.hero.doorCandidates} →
              </a>
              <a href="#teams" className="inline-flex min-h-11 items-center text-base font-semibold text-accent hover:underline">
                {t.hero.doorTeams} →
              </a>
            </div>
            <HorizonField className="mt-8 max-w-xl" />
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {t.hero.proof.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-good" />
                  <LegalText text={p} pending={t.common.legalPending} />
                </li>
              ))}
            </ul>
          </div>

          <div id="sign-in" className="w-full max-w-md lg:justify-self-end">
            <div className="relative overflow-hidden rounded-dialog border border-line bg-surface p-6 sm:p-8 shadow-md">
              <div aria-hidden className="horizon-rule absolute inset-x-0 top-0" />
              <h2 className="text-headline text-foreground">{t.hero.cardTitle}</h2>
              <p className="mt-1 text-sm text-muted">{t.hero.cardTag}</p>
              <form action={login} className="mt-6 space-y-5">
                <TextField
                  label={t.common.email}
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder={t.auth.signIn.emailPlaceholder}
                  required
                  fieldSize="lg"
                />
                <PasswordField
                  label={t.common.password}
                  name="password"
                  autoComplete="current-password"
                  required
                  fieldSize="lg"
                  showLabel={t.common.show}
                  hideLabel={t.common.hide}
                />
                <Link href="/forgot-password" className="inline-block text-sm font-semibold text-accent hover:underline">
                  {t.common.forgot}
                </Link>
                <SubmitButton size="lg" block pendingLabel={t.common.signingIn}>
                  {t.common.signIn}
                </SubmitButton>
              </form>
              <p className="mt-5 text-sm text-muted text-center">
                {t.hero.invitationQuestion}{" "}
                <Link href="/help/invitation" className="font-semibold text-accent hover:underline">
                  {t.hero.invitationLink}
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* Candidates: Fig. 01 */}
        <section id="candidates" className="border-t border-line scroll-mt-16">
          <div className="container-page py-16 lg:py-24 grid gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="text-mono-label text-muted">{t.candidates.eyebrow}</p>
              <h2 className="mt-3 text-display text-foreground">{t.candidates.title}</h2>
              <p className="mt-3 text-body-large text-muted">{t.candidates.lead}</p>
              <dl className="mt-8 space-y-5">
                {t.candidates.points.map((p) => (
                  <div key={p.t} className="border-l-2 border-line pl-4">
                    <dt className="text-base font-semibold text-foreground">{p.t}</dt>
                    <dd className="mt-1 text-base text-muted measure">{p.b}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <Fig n={1} caption={t.candidates.fig.caption}>
              <ExamPreview fig={t.candidates.fig} />
            </Fig>
          </div>
        </section>

        {/* Hiring teams: Fig. 02 */}
        <section id="teams" className="bg-surface-sunken border-y border-line scroll-mt-16">
          <div className="container-page py-16 lg:py-24 grid gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="text-mono-label text-muted">{t.teams.eyebrow}</p>
              <h2 className="mt-3 text-display text-foreground">{t.teams.title}</h2>
              <p className="mt-3 text-body-large text-muted">{t.teams.lead}</p>
              <ol className="mt-8 space-y-6">
                {t.teams.steps.map((s) => (
                  <li key={s.n} className="flex gap-4">
                    <span className="text-mono-label text-muted pt-1 w-7 shrink-0">{s.n}</span>
                    <div>
                      <p className="text-base font-semibold text-foreground">{s.t}</p>
                      <p className="mt-1 text-base text-muted measure">{s.b}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <Fig n={2} caption={t.teams.fig.caption}>
              <EvidenceCard fig={t.teams.fig} />
            </Fig>
          </div>
        </section>

        {/* Trust: Fig. 03 and "At a glance" */}
        <section id="trust" className="scroll-mt-16">
          <div className="container-page py-16 lg:py-24">
            <p className="text-mono-label text-muted">{t.trust.eyebrow}</p>
            <h2 className="mt-3 text-display text-foreground">{t.trust.title}</h2>
            <Fig n={3} className="mt-10">
              <ol className="grid gap-6 md:grid-cols-3 md:gap-0">
                {t.trust.steps.map((s, i) => (
                  <li key={s.t} className="relative md:px-6 first:md:pl-0 last:md:pr-0">
                    {i > 0 && <span aria-hidden className="hidden md:block absolute left-0 top-1 bottom-1 w-px bg-line" />}
                    <p className="text-mono-label text-muted">{String(i + 1).padStart(2, "0")}</p>
                    <p className="mt-2 text-title text-foreground">{s.t}</p>
                    <p className="mt-1 text-base text-muted">
                      <LegalText text={s.b} pending={t.common.legalPending} />
                    </p>
                  </li>
                ))}
              </ol>
            </Fig>

            <div className="mt-12 max-w-3xl">
              <h3 className="text-title-large text-foreground">{t.trust.glanceTitle}</h3>
              <dl className="mt-4 divide-y divide-line-soft border-y border-line">
                {t.trust.glance.map((g) => (
                  <div key={g.k} className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
                    <dt className="text-base font-semibold text-foreground">{g.k}</dt>
                    <dd className="text-base text-muted">
                      <LegalText text={g.v} pending={t.common.legalPending} />
                    </dd>
                  </div>
                ))}
              </dl>
              <Link href="/privacy" className="mt-5 inline-flex min-h-11 items-center text-base font-semibold text-accent hover:underline">
                {t.trust.fullNotice} →
              </Link>
            </div>
          </div>
        </section>

        {/* Closing band: the one navy block on the page */}
        <section className="relative overflow-hidden bg-panel text-on-panel">
          <NodeField className="absolute inset-0 w-full h-full opacity-40" />
          <div className="container-page relative py-16 lg:py-20 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-display text-on-panel">{t.closing.title}</h2>
              <p className="mt-3 text-body-large text-on-panel-muted">{t.closing.body}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/login" variant="panel" size="lg">
                {t.closing.signIn}
              </ButtonLink>
              <ButtonLink href="/help/invitation" variant="panelGhost" size="lg">
                {t.closing.haveInvitation}
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="container-page flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-6 text-sm text-muted">
          <span>{t.footer.copyright}</span>
          <nav aria-label={t.nav.privacy} className="flex flex-wrap gap-x-6">
            <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-foreground">
              {t.nav.privacy}
            </Link>
            <Link href="/help/invitation" className="inline-flex min-h-11 items-center hover:text-foreground">
              {t.nav.invitationHelp}
            </Link>
            <Link href="/about" className="inline-flex min-h-11 items-center hover:text-foreground">
              {t.nav.about}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
