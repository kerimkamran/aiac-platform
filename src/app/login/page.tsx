import Link from "next/link";
import { login } from "./actions";
import { AuthShell } from "@/components/AuthShell";
import { TextField } from "@/components/ui/Field";
import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Callout } from "@/components/ui/Callout";
import { getT } from "@/i18n/server";
import { safeNextPath } from "@/lib/home";

export const metadata = { title: "Sign in" };

const ERROR_KEYS = {
  "wrong-password": "wrongPassword",
  deactivated: "deactivated",
  inactive: "inactive",
  "too-many": "tooMany",
  expired: "expired",
  generic: "generic",
  missing: "missing",
} as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const { t } = await getT();
  const key = error ? ERROR_KEYS[error as keyof typeof ERROR_KEYS] : undefined;
  const message = key ? t.auth.errors[key] : error ? t.auth.errors.generic : null;
  const safeNext = safeNextPath(next);

  return (
    <AuthShell title={t.auth.signIn.title} subtitle={t.auth.signIn.subtitle}>
      <form action={login} className="space-y-5">
        {message && (
          <Callout tone="critical" role="alert">
            {message}
          </Callout>
        )}
        {safeNext && <input type="hidden" name="next" value={safeNext} />}
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
        <div className="flex items-center justify-between gap-4">
          <Link href="/forgot-password" className="text-sm text-accent font-semibold hover:underline">
            {t.common.forgot}
          </Link>
        </div>
        <SubmitButton size="lg" block pendingLabel={t.common.signingIn}>
          {t.common.signIn}
        </SubmitButton>
        <p className="text-sm text-muted text-center">
          {t.auth.signIn.firstTime}{" "}
          <Link href="/help/invitation" className="text-accent font-semibold hover:underline">
            {t.auth.signIn.invitationLink}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
