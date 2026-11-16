import Link from "next/link";
import { VantageMark } from "@/components/VantageMark";
import { AppearanceMenu } from "@/components/AppearanceMenu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getT } from "@/i18n/server";

// The shared sign-in layout (redesign plan B11): logo, one white card on the
// Azerconnect tint, a language switch, and a quiet footer. No decoration.
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
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 px-4 sm:px-8 py-4">
        <Link href="/" className="flex items-center gap-3 rounded-md" aria-label={t.common.appName}>
          <VantageMark className="w-9 h-9" />
          <span className="text-xl font-semibold text-foreground">{t.common.appName}</span>
          <span className="hidden sm:inline text-sm text-muted pl-3 border-l border-line">{t.common.company}</span>
        </Link>
        <div className="flex items-center gap-1">
          <LanguageSwitcher current={lang} label={t.common.language} />
          <AppearanceMenu />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 flex items-start sm:items-center justify-center px-4 sm:px-8 py-6 focus:outline-none">
        <div className="w-full max-w-[640px] sm:max-w-md">
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
  );
}
