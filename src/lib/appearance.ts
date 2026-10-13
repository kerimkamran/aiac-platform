// Appearance preferences (plan v2, section 4.5): theme (light, dark or
// system) and background canvas (white, cream or grey). The choice is kept in
// the browser so it applies before first paint, and mirrored to the signed-in
// user's profile so it follows them across devices.

export type ThemeChoice = "light" | "dark" | "system";
export type CanvasChoice = "white" | "cream" | "grey";

export type Appearance = { theme: ThemeChoice; canvas: CanvasChoice };

export const DEFAULT_APPEARANCE: Appearance = { theme: "system", canvas: "white" };

export const APPEARANCE_STORAGE_KEY = "vantage-appearance";
// Read-only fallback for the theme key this app used before plan v2.
const LEGACY_THEME_KEY = "aiac-theme";

export function isThemeChoice(v: unknown): v is ThemeChoice {
  return v === "light" || v === "dark" || v === "system";
}

export function isCanvasChoice(v: unknown): v is CanvasChoice {
  return v === "white" || v === "cream" || v === "grey";
}

// Accepts any value (from storage or the server) and returns a valid choice.
export function normalizeAppearance(raw: unknown): Appearance {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    theme: isThemeChoice(o.theme) ? o.theme : DEFAULT_APPEARANCE.theme,
    canvas: isCanvasChoice(o.canvas) ? o.canvas : DEFAULT_APPEARANCE.canvas,
  };
}

export function readStoredAppearance(): Appearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (raw) return normalizeAppearance(JSON.parse(raw));
    const legacy = window.localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === "dark" || legacy === "light") return normalizeAppearance({ theme: legacy });
  } catch {
    // Storage can be blocked; fall back to the defaults.
  }
  return DEFAULT_APPEARANCE;
}

export function storeAppearance(a: Appearance): void {
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(a));
  } catch {
    // Ignore: the choice still applies for this page view.
  }
}

// Applies the choice to the document. The dark class follows the theme, or
// the operating system when the theme is "system". The canvas attribute is
// only written for cream and grey, and never affects dark mode (CSS guards).
export function applyAppearance(a: Appearance): void {
  const root = document.documentElement;
  const systemDark = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = a.theme === "dark" || (a.theme === "system" && systemDark);
  root.classList.toggle("dark", dark);
  if (a.canvas === "white") root.removeAttribute("data-canvas");
  else root.setAttribute("data-canvas", a.canvas);
}
