import { PublicShell } from "@/components/PublicShell";
import { getT } from "@/i18n/server";

export const metadata = { title: "About" };

export default async function AboutPage() {
  const { t } = await getT();
  return (
    <PublicShell>
      <h1 className="text-display text-foreground">{t.about.title}</h1>
      <p className="mt-4 text-body-large text-muted measure">{t.about.body}</p>
      <h2 className="mt-10 text-title-large text-foreground">{t.about.aiTitle}</h2>
      <p className="mt-2 text-base text-muted measure">{t.about.aiBody}</p>
      <p className="mt-12 border-t border-line pt-6 text-sm text-muted">
        <a href="https://www.linkedin.com/in/thekmrnkrml/" target="_blank" rel="noreferrer" className="hover:text-foreground underline underline-offset-4">
          {t.about.credit}
        </a>
      </p>
    </PublicShell>
  );
}
