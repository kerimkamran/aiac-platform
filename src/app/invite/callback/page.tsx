import { AuthShell } from "@/components/AuthShell";
import { getT } from "@/i18n/server";
import { SetPasswordFlow } from "./SetPasswordFlow";

export const metadata = { title: "Set your password" };

export default async function InviteCallbackPage() {
  const { t } = await getT();
  return (
    <AuthShell title={t.auth.setPassword.title} subtitle={t.auth.setPassword.subtitle}>
      <SetPasswordFlow t={t} />
    </AuthShell>
  );
}
