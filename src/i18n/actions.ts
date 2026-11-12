"use server";

import { cookies } from "next/headers";
import { LANG_COOKIE, isLang } from "./index";

// Stores the visitor's language choice. A server action keeps the cookie
// handling in one place and lets the page re-render in the new language.
export async function setLanguage(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
