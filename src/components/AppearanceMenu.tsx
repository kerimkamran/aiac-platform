"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
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

// Appearance menu (plan v2, section 4.5). It replaces the old "Dark mode"
// text toggle. Theme is light, dark or system; background is white, cream or
// grey and only applies in light mode. The choice is saved in the browser and
// on the profile.
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

export function AppearanceMenu({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>({ theme: "system", canvas: "white" });
  const ref = useRef<HTMLDivElement>(null);

  // On mount: take the browser's choice, then reconcile with the profile so
  // a change made on another device is picked up.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const local = readStoredAppearance();
    setAppearance(local);
    let cancelled = false;
    loadMyAppearance()
      .then((remote) => {
        if (cancelled || !remote) return;
        if (remote.theme !== local.theme || remote.canvas !== local.canvas) {
          storeAppearance(remote);
          applyAppearance(remote);
          setAppearance(remote);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  function update(patch: Partial<Appearance>) {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    storeAppearance(next);
    applyAppearance(next);
    void saveMyAppearance(next).catch(() => {});
  }

  const dark = appearance.theme === "dark";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Appearance"
        className="inline-flex items-center justify-center w-10 h-10 rounded-full text-muted hover:text-foreground hover:bg-line-soft focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus"
      >
        <Icon name={dark ? "moon" : "sun"} className="w-5 h-5" />
      </button>
      {open && (
        <div role="dialog" aria-label="Appearance settings" className="absolute right-0 top-12 z-50 w-72 rounded-[16px] bg-surface ring-1 ring-line shadow-lg p-4 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Theme</p>
            <SegmentedControl label="Theme" options={THEMES} value={appearance.theme} onChange={(theme) => update({ theme })} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Background</p>
            <SegmentedControl
              label="Background"
              options={CANVASES}
              value={appearance.canvas}
              onChange={(canvas) => update({ canvas })}
              disabled={dark}
            />
            <p className="text-xs text-muted">{dark ? "Dark mode uses its own background." : "Applies in light mode."}</p>
          </div>
        </div>
      )}
    </div>
  );
}
