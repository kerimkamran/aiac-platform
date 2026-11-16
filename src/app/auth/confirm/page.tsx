import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Callout } from "@/components/ui/Callout";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/i18n/server";
import { isTokenHash, parseLinkType } from "@/lib/set-password-link";
import { confirmLink } from "./actions";

export const metadata = { title: "Open your account", robots: { index: false, follow: false } };

// Where invitation and password-reset emails land. Opening the page does
// nothing by itself: the link is only used up when the person selects
// Continue. Mail security scanners open links in emails ahead of the reader,
// and a link that signed in on open would already be spent by the time a real
// person clicked it.
export default async function ConfirmLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash: tokenHash, type: rawType } = await searchParams;
  const type = parseLinkType(rawType);
  if (!isTokenHash(tokenHash) || !type) redirect("/invite/callback?link=invalid");

  const { t } = await getT();
  // Someone already signed in here (for example an HR admin checking a copied
  // link) would be signed out and use the link up by continuing. Say so.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthShell title={t.auth.confirm.title} subtitle={t.auth.confirm.subtitle}>
      {user?.email && (
        <Callout tone="info" className="mb-5">
          <p>
            {t.auth.confirm.signedInAs} <span className="font-semibold break-all">{user.email}</span>
          </p>
          <p className="mt-1">{t.auth.confirm.signedInWarning}</p>
        </Callout>
      )}
      <form action={confirmLink}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <SubmitButton size="lg" block pendingLabel={t.auth.confirm.pending}>
          {t.common.continue}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
