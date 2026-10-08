"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Design-execution-plan Phase 5 / T5.5: a lot of this app's server actions
// report validation failures by redirecting back with `?error=<message>`,
// which `ToastFromParams` (Toaster.tsx) picks up and shows as a floating
// toast in the bottom corner -- disconnected from the field that's actually
// wrong. This component reads the same `error` param but, when the action
// also set `?field=<name>`, renders the message inline next to the one
// <InlineFormError field="..."> instance whose `field` matches, so the
// person sees the problem right next to the input that caused it instead of
// hunting for a toast. An instance with no `field` prop is the catch-all: it
// only fires when the error carries no `field` at all (general/unattributed
// failures), so it never doubles up with a field-specific instance elsewhere
// on the same page.
//
// Mirrors ToastFromParamsInner's read-once-then-clear-the-URL mechanic, but
// keeps the message in local state (rather than re-deriving it from
// searchParams on every render) so the text stays visible after the URL is
// cleaned up -- otherwise it would vanish the instant router.replace()
// resolves, before anyone could read it.
//
// The message is captured during render (the "adjust state while rendering"
// pattern React recommends for deriving state from a prop/param change)
// rather than inside the URL-clearing effect below, so that effect only
// ever touches the router -- an external system -- and never calls a state
// setter itself.
function InlineFormErrorInner({ field, className }: { field?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.toString();

  const [processedRaw, setProcessedRaw] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (raw !== processedRaw) {
    setProcessedRaw(raw);
    const error = searchParams.get("error");
    const errorField = searchParams.get("field");
    const mine = !!error && (field ? errorField === field : !errorField);
    if (mine) setMessage(decodeURIComponent(error!));
  }

  useEffect(() => {
    const error = searchParams.get("error");
    const errorField = searchParams.get("field");
    const mine = !!error && (field ? errorField === field : !errorField);
    if (!mine) return;

    const next = new URLSearchParams(searchParams.toString());
    next.delete("error");
    next.delete("field");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  if (!message) return null;

  return (
    <p role="alert" className={className ?? "text-xs font-medium text-critical mt-1.5"}>
      {message}
    </p>
  );
}

/**
 * Drop next to a form field: shows `?error=` inline (and clears it from the
 * URL) when it was attributed to this `field` via `?field=`. Omit `field`
 * for a catch-all instance that only shows errors with no `field` set.
 */
export function InlineFormError({ field, className }: { field?: string; className?: string }) {
  return (
    <Suspense fallback={null}>
      <InlineFormErrorInner field={field} className={className} />
    </Suspense>
  );
}
