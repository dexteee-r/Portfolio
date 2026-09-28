// Relative import: next.config.ts reads this file, without the "@/" alias.
import { locales, type Locale } from "../i18n/config";

/**
 * Pages that sit on the frame beside the desk — not chapters, not projects.
 * Each has its own slug per language, like the chapters: `/fr/mentions-legales`,
 * `/en/legal-notice`. Every slug is a route folder of the same name under
 * `src/app/[locale]/`; a unit test keeps the two in step.
 */
export const pageIds = ["legal"] as const;
export type PageId = (typeof pageIds)[number];

export const pageSlugs: Record<PageId, Record<Locale, string>> = {
  legal: { fr: "mentions-legales", en: "legal-notice" },
};

export function pageFromSlug(locale: Locale, slug: string): PageId | null {
  return pageIds.find((id) => pageSlugs[id][locale] === slug) ?? null;
}

/** The language a page's slug belongs to: each route folder shows the page in that language. */
export function localeOfPageSlug(page: PageId, slug: string): Locale {
  const locale = locales.find((l) => pageSlugs[page][l] === slug);
  if (!locale) throw new Error(`"${slug}" is not a slug of page "${page}"`);
  return locale;
}

export interface SlugRedirect {
  source: string;
  destination: string;
  permanent: true;
}

/**
 * A route folder is built under every locale — Next cannot limit a static
 * folder to one value of its parent's parameter. So a page's slug under the
 * wrong language never shows that copy: it redirects, permanently, to the
 * page's own slug in the language of the URL (`/en/mentions-legales` →
 * `/en/legal-notice`). Config redirects run before any page is served.
 */
export function pageSlugRedirects(): SlugRedirect[] {
  return pageIds.flatMap((page) =>
    locales.flatMap((locale) =>
      locales
        .map((other) => pageSlugs[page][other])
        .filter((slug) => slug !== pageSlugs[page][locale])
        .map((slug) => ({
          source: `/${locale}/${slug}`,
          destination: `/${locale}/${pageSlugs[page][locale]}`,
          permanent: true as const,
        })),
    ),
  );
}
