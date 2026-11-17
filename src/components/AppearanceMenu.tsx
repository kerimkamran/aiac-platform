"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useShellText } from "@/components/shell-i18n";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  applyAppearance,
  readStoredAppearance,
  storeAppearance,
  type Appearance,
  type CanvasChoice,
  type ThemeChoice,
} from "@/lib/appearance";
import { loadMyAppearance, saveMyAppearance } from "@/app/appearance-actions";

// Appearance (Clear Horizon plan, section 15). Theme is light, dark or system;
// background is white, cream or grey and only applies in light mode. The choice
// is saved in the browser and, for signed-in people, on the profile.
//
// AppearancePanel is the controls themselves (used inside the account menu and
// the mobile sheet). AppearanceMenu wraps it in an icon button and popover for
// pages without an account menu (landing, sign-in).
function hasStoredCanvas(): boolean {
  try {
    const raw = window.localStorage.getItem("vantage-appearance");
    return !!raw && typeof JSON.parse(raw)?.canvas === "string";
  } catch {
    return false;
  }
}

// `defaultCanvas` is the role default (cream for candidates) shown until the
// person makes an explicit choice. `signedIn` controls whether the choice is
// also saved to the profile.
export function AppearancePanel({
  defaultCanvas = "white",
  signedIn = true,
  onChange,
}: {
  defaultCanvas?: CanvasChoice;
  signedIn?: boolean;
  onChange?: (a: Appearance) => void;
}) {
  const { text } = useShellText();
  const themes: { value: ThemeChoice; label: string }[] = [
    { value: "light", label: text.themeLight },
    { value: "dark", label: text.themeDark },
    { value: "system", label: text.themeSystem },
  ];
  const [appearance, setAppearance] = useState<Appearance>({ theme: "system", canvas: defaultCanvas });

  // On mount: take the browser's choice, then reconcile with the profile so
  // a change made on another device is picked up.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const local = readStoredAppearance();
    const explicit = hasStoredCanvas();
    const start = { ...local, canvas: explicit ? local.canvas : defaultCanvas };
    setAppearance(start);
    onChange?.(start);
    if (!signedIn) return;
    let cancelled = false;
    loadMyAppearance()
      .then((remote) => {
        if (cancelled || !remote) return;
        if (remote.theme !== start.theme || remote.canvas !== start.canvas) {
          storeAppearance(remote);
          applyAppearance(remote);
          setAppearance(remote);
          onChange?.(remote);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // "System" follows the device while the page is open, not only after a reload (UX-B-18).
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = readStoredAppearance();
      if (current.theme === "system") applyAppearance(current);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function update(patch: Partial<Appearance>) {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    storeAppearance(next);
    applyAppearance(next);
    onChange?.(next);
    if (signedIn) void saveMyAppearance(next).catch(() => {});
  }

  const dark = appearance.theme === "dark";
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">{text.theme}</p>
        <SegmentedControl label={text.theme} options={themes} value={appearance.theme} onChange={(theme) => update({ theme })} />
      </div>
      <p className="text-sm text-muted">{dark ? text.themeDarkNote : text.themeSystemNote}</p>
    </div>
  );
}

export function AppearanceMenu({
  className = "",
  defaultCanvas = "white",
  signedIn = false,
  tone = "default",
}: {
  className?: string;
  defaultCanvas?: CanvasChoice;
  signedIn?: boolean;
  // "panel" is for use on the navy brand panel.
  tone?: "default" | "panel";
}) {
  const { text } = useShellText();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The icon follows the choice: sun, moon, or a monitor for System.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setTheme(readStoredAppearance().theme);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const icon = theme === "dark" ? "moon" : theme === "light" ? "sun" : "monitor";
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={text.appearance}
        className={`press inline-flex items-center justify-center w-11 h-11 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
          tone === "panel" ? "text-on-panel-muted hover:text-on-panel hover:bg-on-panel/10" : "text-muted hover:text-foreground hover:bg-surface-sunken"
        }`}
      >
        <Icon name={icon} className="w-5 h-5" />
      </button>
      {open && (
        <div role="dialog" aria-label={text.appearanceSettings} className="anim-menu absolute right-0 top-12 z-50 w-80 rounded-xl bg-surface text-foreground border border-line shadow-md p-4">
          <AppearancePanel defaultCanvas={defaultCanvas} signedIn={signedIn} onChange={(a) => setTheme(a.theme)} />
        </div>
      )}
    </div>
  );
}
