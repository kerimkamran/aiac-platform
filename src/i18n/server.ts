import { cookies, headers } from "next/headers";
import { LANG_COOKIE, resolveLang, type Lang } from "./index";
import { getDict, type Dict } from "./dictionaries";

// The language for this request: cookie, then browser, then English.
export async function getLang(): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return resolveLang(c.get(LANG_COOKIE)?.value, h.get("accept-language"));
}

export async function getT(): Promise<{ lang: Lang; t: Dict }> {
  const lang = await getLang();
  return { lang, t: getDict(lang) };
}
