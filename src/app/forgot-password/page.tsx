import { AuthShell } from "@/components/AuthShell";
import { getT } from "@/i18n/server";
import { ResetForm } from "./ResetForm";

export const metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage() {
  const { t } = await getT();
  return (
    <AuthShell title={t.auth.reset.title} subtitle={t.auth.reset.subtitle}>
      <ResetForm t={t} />
    </AuthShell>
  );
}
