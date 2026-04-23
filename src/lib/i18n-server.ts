import { cookies } from "next/headers";
import { translate, type Lang } from "./i18n-dict";

/**
 * Read the active language preference on the server (from the `pfms-lang` cookie
 * set by LangProvider on the client). Falls back to EN when no cookie is present.
 */
export async function getServerLang(): Promise<Lang> {
  const c = await cookies();
  const v = c.get("pfms-lang")?.value;
  return v === "id" || v === "en" ? v : "en";
}

/**
 * Convenience: returns a bound `t()` for the current server request.
 *
 *   const t = await getServerT();
 *   <h1>{t("page.dashboard.header")}</h1>
 */
export async function getServerT(): Promise<(key: string) => string> {
  const lang = await getServerLang();
  return (key: string) => translate(key, lang);
}

/**
 * Returns both the bound `t()` and the active `lang` — useful when a page
 * also needs to pass `lang` to data-name translators (commodities, dates)
 * or locale-sensitive formatters without making two separate calls.
 */
export async function getServerI18n(): Promise<{
  t: (key: string) => string;
  lang: Lang;
}> {
  const lang = await getServerLang();
  return { lang, t: (key: string) => translate(key, lang) };
}
