"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLanguage } from "@/i18n/actions";
import { LANGS, LANG_LABEL, LANG_NAME, type Lang } from "@/i18n";

// EN · AZ · RU switcher (Clear Horizon plan, section 17). It appears only on
// translated pages. The choice is a cookie, read on the server for the next
// request; the page refreshes in place and the <html lang> attribute follows.
export function LanguageSwitcher({
  current,
  label,
  tone = "default",
}: {
  current: Lang;
  label: string;
  tone?: "default" | "panel";
}) {
  const router = useRouter();
  const [, start] = useTransition();

  function choose(lang: Lang) {
    if (lang === current) return;
    start(async () => {
      await setLanguage(lang);
      router.refresh();
    });
  }

  return (
    <div role="group" aria-label={label} className="inline-flex items-center">
      {LANGS.map((l) => {
        const on = l === current;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={on}
            title={LANG_NAME[l]}
            onClick={() => choose(l)}
            className={`press min-w-11 min-h-11 px-2 rounded-md text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              tone === "panel"
                ? on
                  ? "text-on-panel"
                  : "text-on-panel-muted hover:text-on-panel"
                : on
                  ? "text-foreground underline underline-offset-8 decoration-2"
                  : "text-muted hover:text-foreground"
            }`}
          >
            {LANG_LABEL[l]}
          </button>
        );
      })}
    </div>
  );
}
