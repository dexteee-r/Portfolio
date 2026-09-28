import { chapterFromSlug, chapterSlugs, type ChapterId } from "@/content/chapters";
import { pageFromSlug, pageSlugs, type PageId } from "@/content/pages";
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

/** A page of the frame: `/fr/mentions-legales`, `/en/legal-notice`. */
export function pagePath(locale: Locale, page: PageId): string {
  return `/${locale}/${pageSlugs[page][locale]}`;
}

/** The segment after the locale, in another language: chapter and page slugs are translated. */
function translateSlug(from: Locale, slug: string, target: Locale): string {
  const chapter = chapterFromSlug(from, slug);
  if (chapter) return chapterSlugs[chapter][target];
  const page = pageFromSlug(from, slug);
  if (page) return pageSlugs[page][target];
  return slug;
}

/**
 * The same page in another language. Chapter and page slugs are translated
 * (`/fr/creatif/x` ↔ `/en/creative/x`, `/fr/mentions-legales` ↔
 * `/en/legal-notice`); everything else is kept as is. A path that carries no
 * locale lands on the target language's desk.
 */
export function switchLocalePath(pathname: string, target: Locale): string {
  const [, first = "", ...rest] = pathname.split("/");
  if (!isLocale(first)) return homePath(target);

  const [slug, ...tail] = rest.filter(Boolean);
  if (slug === undefined) return homePath(target);

  return ["", target, translateSlug(first, slug, target), ...tail].join("/");
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
