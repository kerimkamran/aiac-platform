import Link from "next/link";
import { VantageMark } from "@/components/VantageMark";
import { AppearanceMenu } from "@/components/AppearanceMenu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getT } from "@/i18n/server";

// Frame for the simple public pages (About, Privacy, 404): logo, language and
// appearance controls, a readable column, and the shared footer.
export async function PublicShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const { lang, t } = await getT();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="glass sticky top-0 z-40 border-b border-line-soft">
        <div className="container-page flex h-14 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 rounded-md" aria-label={t.common.appName}>
            <VantageMark className="w-8 h-8" />
            <span className="text-lg font-semibold text-foreground">{t.common.appName}</span>
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher current={lang} label={t.common.language} />
            <AppearanceMenu />
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className={`flex-1 container-page py-12 lg:py-16 focus:outline-none ${wide ? "" : "max-w-3xl"}`}>
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="container-page flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-6 text-sm text-muted">
          <span>{t.footer.copyright}</span>
          <nav className="flex flex-wrap gap-x-6" aria-label={t.nav.main}>
            <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-foreground">{t.nav.privacy}</Link>
            <Link href="/help/invitation" className="inline-flex min-h-11 items-center hover:text-foreground">{t.nav.invitationHelp}</Link>
            <Link href="/about" className="inline-flex min-h-11 items-center hover:text-foreground">{t.nav.about}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
