"use client";

import { useState } from "react";
import Link from "next/link";
import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Icon } from "@/components/ui/Icon";
import { requestPasswordReset } from "./actions";
import type { Dict } from "@/i18n/dictionaries";

// Always ends in "Check your email", whether or not an account exists, so the
// form can't be used to find out who is registered.
export function ResetForm({ t }: { t: Dict }) {
  const [sent, setSent] = useState(false);

  async function submit(formData: FormData) {
    await requestPasswordReset(formData);
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-full bg-good-soft text-good grid place-items-center shrink-0">
            <Icon name="mail" className="w-5 h-5" />
          </span>
          <div>
            <p className="text-lg font-semibold text-foreground">{t.auth.reset.sentTitle}</p>
            <p className="text-base text-muted mt-1">{t.auth.reset.sentBody}</p>
          </div>
        </div>
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline min-h-11">
          <Icon name="arrowLeft" className="w-4 h-4" />
          {t.common.backToSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-5">
      <TextField label={t.common.email} name="email" type="email" autoComplete="email" placeholder={t.auth.signIn.emailPlaceholder} required fieldSize="lg" />
      <SubmitButton size="lg" block pendingLabel={t.auth.reset.pending}>
        {t.auth.reset.button}
      </SubmitButton>
      <p className="text-center">
        <Link href="/login" className="text-sm font-semibold text-accent hover:underline">
          {t.common.backToSignIn}
        </Link>
      </p>
    </form>
  );
}
