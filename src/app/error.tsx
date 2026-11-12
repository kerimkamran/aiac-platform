"use client";

import { useEffect, useState } from "react";
import { ALL_DICTS } from "@/i18n/dictionaries";
import { isLang, type Lang } from "@/i18n";
import { Button, ButtonLink } from "@/components/ui/Button";

// Route-level error boundary. It cannot read cookies on the server, so the
// language comes from <html lang>, which the root layout already set.
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const l = document.documentElement.lang;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of <html lang>
    if (isLang(l)) setLang(l);
  }, []);
  useEffect(() => {
    console.error(error);
  }, [error]);
  const t = ALL_DICTS[lang];
  return (
    <main id="main-content" tabIndex={-1} className="container-page max-w-3xl py-24 focus:outline-none">
      <p className="text-mono-label text-muted">{error.digest ? `Ref ${error.digest}` : "Error"}</p>
      <h1 className="mt-3 text-display text-foreground">{t.errors.error.title}</h1>
      <p className="mt-3 text-body-large text-muted measure">{t.errors.error.body}</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Button size="lg" onClick={reset}>{t.common.tryAgain}</Button>
        <ButtonLink href="/" variant="secondary" size="lg">{t.common.goHomeGeneric}</ButtonLink>
      </div>
    </main>
  );
}
