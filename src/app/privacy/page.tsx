import { PublicShell } from "@/components/PublicShell";
import { LegalText } from "@/components/LegalText";
import { getT } from "@/i18n/server";

export const metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const { t } = await getT();
  return (
    <PublicShell>
      <h1 className="text-display text-foreground">{t.privacy.title}</h1>
      <p className="mt-4 text-body-large text-muted measure">{t.privacy.lead}</p>
      <div className="mt-10 divide-y divide-line-soft border-y border-line">
        {t.privacy.sections.map((s) => (
          <section key={s.t} className="py-6">
            <h2 className="text-title text-foreground">{s.t}</h2>
            <p className="mt-2 text-base text-muted measure">
              <LegalText text={s.b} pending={t.common.legalPending} />
            </p>
          </section>
        ))}
      </div>
    </PublicShell>
  );
}
