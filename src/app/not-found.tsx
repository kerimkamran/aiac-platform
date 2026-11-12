import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/home";
import { getT } from "@/i18n/server";
import { NodeField } from "@/components/horizon/NodeField";
import { ButtonLink } from "@/components/ui/Button";
import { PublicShell } from "@/components/PublicShell";

// 404: the V drifting out of frame. "Go to my home" follows the visitor's role.
export default async function NotFound() {
  const { t } = await getT();
  let home = "/";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const dest = homeFor(profile?.role);
      if (dest !== "/login") home = dest;
    }
  } catch {
    /* fall back to the landing page */
  }
  const signedIn = home !== "/";
  return (
    <PublicShell wide>
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center py-6">
        <div>
          <p className="text-mono-label text-muted">404</p>
          <h1 className="mt-3 text-display text-foreground">{t.errors.notFound.title}</h1>
          <p className="mt-3 text-body-large text-muted measure">{t.errors.notFound.body}</p>
          <div className="mt-7">
            <ButtonLink href={home} size="lg">
              {signedIn ? t.common.goHome : t.common.goHomeGeneric}
            </ButtonLink>
          </div>
        </div>
        <NodeField tone="page" drift className="w-full h-auto max-h-80" />
      </div>
    </PublicShell>
  );
}
