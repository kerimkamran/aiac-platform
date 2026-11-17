"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useShellText } from "@/components/shell-i18n";
import { fillText } from "@/lib/dates";

// Error state shown inside the signed-in shell, so the top bar and navigation
// stay in place when one page fails (plan UX-ADD-06). The shell already
// provides the main landmark, so this renders content only.
export function SectionError({
  error,
  reset,
  homeHref,
  homeLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref: string;
  homeLabel: string;
}) {
  const { text } = useShellText();
  const w = text.section;
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="container-page max-w-2xl py-16">
      <h1 className="text-2xl font-bold text-foreground">{w.title}</h1>
      <p className="mt-3 text-base text-muted">{w.body}</p>
      {error.digest ? <p className="mt-2 text-sm text-muted">{fillText(w.reference, { code: error.digest })}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button size="lg" onClick={reset}>
          {w.tryAgain}
        </Button>
        <ButtonLink href={homeHref} variant="secondary" size="lg">
          {homeLabel}
        </ButtonLink>
      </div>
    </div>
  );
}
