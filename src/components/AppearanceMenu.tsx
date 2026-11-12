"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
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
const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];
const CANVASES: { value: CanvasChoice; label: string }[] = [
  { value: "white", label: "White" },
  { value: "cream", label: "Cream" },
  { value: "grey", label: "Grey" },
];

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
        <p className="text-sm font-semibold text-foreground">Theme</p>
        <SegmentedControl label="Theme" options={THEMES} value={appearance.theme} onChange={(theme) => update({ theme })} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Background</p>
        <SegmentedControl label="Background" options={CANVASES} value={appearance.canvas} onChange={(canvas) => update({ canvas })} disabled={dark} />
        <p className="text-sm text-muted">{dark ? "Dark mode uses its own background." : "Applies in light mode."}</p>
      </div>
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
        aria-label="Appearance"
        className={`press inline-flex items-center justify-center w-11 h-11 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
          tone === "panel" ? "text-on-panel-muted hover:text-on-panel hover:bg-on-panel/10" : "text-muted hover:text-foreground hover:bg-surface-sunken"
        }`}
      >
        <Icon name={icon} className="w-5 h-5" />
      </button>
      {open && (
        <div role="dialog" aria-label="Appearance settings" className="anim-menu absolute right-0 top-12 z-50 w-80 rounded-xl bg-surface text-foreground border border-line shadow-md p-4">
          <AppearancePanel defaultCanvas={defaultCanvas} signedIn={signedIn} onChange={(a) => setTheme(a.theme)} />
        </div>
      )}
    </div>
  );
}
