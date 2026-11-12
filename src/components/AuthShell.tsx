import Link from "next/link";
import { VantageMark } from "@/components/VantageMark";
import { NodeField } from "@/components/horizon/NodeField";
import { AppearanceMenu } from "@/components/AppearanceMenu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getT } from "@/i18n/server";

// The shared sign-in layout (Clear Horizon plan, section 10). Desktop: a navy
// brand panel on the left (mark, a resting node-field V, the horizon, and "AI
// drafts. People decide.") and the form on the right with language and
// appearance controls. Mobile: the panel becomes a 104px band above the form.
// Used by sign in, invitation help, password reset and set password.
export async function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { lang, t } = await getT();
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <aside className="relative overflow-hidden bg-panel text-on-panel h-[104px] lg:h-auto lg:w-[44%] lg:min-h-screen lg:shrink-0">
        <NodeField className="absolute inset-0 w-full h-full opacity-60 lg:opacity-100" />
        <div className="relative h-full flex lg:flex-col lg:justify-between px-5 sm:px-8 lg:p-12 items-center lg:items-stretch">
          <Link href="/" className="flex items-center gap-3 rounded-md" aria-label={t.common.appName}>
            <VantageMark className="w-9 h-9" />
            <span className="text-xl font-semibold text-on-panel">{t.common.appName}</span>
            <span className="hidden sm:inline text-sm text-on-panel-muted pl-3 border-l border-panel-line/60">{t.common.company}</span>
          </Link>
          <div className="hidden lg:block max-w-sm">
            <div className="horizon-rule w-16 mb-6" aria-hidden />
            <p className="text-display text-on-panel">{t.auth.panelStatement}</p>
            <p className="text-base text-on-panel-muted mt-4">{t.auth.panelSub}</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-end gap-1 px-4 sm:px-8 pt-3">
          <LanguageSwitcher current={lang} label={t.common.language} />
          <AppearanceMenu />
        </div>
        <main id="main-content" tabIndex={-1} className="flex-1 flex items-center justify-center px-4 sm:px-8 py-8 focus:outline-none">
          <div className="w-full max-w-md anim-fade-up">
            <div className="rounded-dialog border border-line bg-surface p-6 sm:p-8">
              <h1 className="text-headline text-foreground">{title}</h1>
              {subtitle && <p className="text-base text-muted mt-2">{subtitle}</p>}
              <div className="mt-6">{children}</div>
            </div>
          </div>
        </main>
        <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 px-6 py-6 text-sm text-muted">
          <Link href="/privacy" className="hover:text-foreground">
            {t.nav.privacy}
          </Link>
          <Link href="/help/invitation" className="hover:text-foreground">
            {t.nav.invitationHelp}
          </Link>
          <Link href="/about" className="hover:text-foreground">
            {t.nav.about}
          </Link>
          <span>{t.footer.copyright}</span>
        </footer>
      </div>
    </div>
  );
}
