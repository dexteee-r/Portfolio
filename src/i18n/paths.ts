import { chapterFromSlug, chapterSlugs, type ChapterId } from "@/content/chapters";
import { defaultLocale, isLocale, locales, type Locale } from "./config";

export function homePath(locale: Locale): string {
  return `/${locale}`;
}

export function chapterPath(locale: Locale, chapter: ChapterId): string {
  return `/${locale}/${chapterSlugs[chapter][locale]}`;
}

export function projectPath(locale: Locale, chapter: ChapterId, project: string): string {
  return `${chapterPath(locale, chapter)}/${project}`;
}

/**
 * The same page in another language. Chapter slugs are translated
 * (`/fr/creatif/x` ↔ `/en/creative/x`); everything else is kept as is.
 * A path that carries no locale lands on the target language's desk.
 */
export function switchLocalePath(pathname: string, target: Locale): string {
  const [, first = "", ...rest] = pathname.split("/");
  if (!isLocale(first)) return homePath(target);

  const [chapterSlug, ...tail] = rest.filter(Boolean);
  if (chapterSlug === undefined) return homePath(target);

  const chapter = chapterFromSlug(first, chapterSlug);
  const translated = chapter ? chapterSlugs[chapter][target] : chapterSlug;
  return ["", target, translated, ...tail].join("/");
}

/**
 * hreflang map for a page, as Next's `alternates.languages` expects it.
 * `x-default` points at the default locale.
 */
export function languageAlternates(pathFor: (locale: Locale) => string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const locale of locales) map[locale] = pathFor(locale);
  map["x-default"] = pathFor(defaultLocale);
  return map;
}
