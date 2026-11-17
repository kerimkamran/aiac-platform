"use client";

import { createContext, useContext } from "react";
import { en } from "@/i18n/en";
import type { Dict } from "@/i18n/en";
import type { Lang } from "@/i18n";

// The words used inside the signed-in app shell (menu bar, account menu,
// notifications, search). The root layout provides them for the request's
// language, so small client components can read them without prop drilling.
// Without a provider (tests, previews) they fall back to English.
export type ShellText = Dict["shell"];

const ShellTextContext = createContext<{ lang: Lang; text: ShellText }>({ lang: "en", text: en.shell });

export function ShellTextProvider({ lang, text, children }: { lang: Lang; text: ShellText; children: React.ReactNode }) {
  return <ShellTextContext.Provider value={{ lang, text }}>{children}</ShellTextContext.Provider>;
}

export function useShellText() {
  return useContext(ShellTextContext);
}
