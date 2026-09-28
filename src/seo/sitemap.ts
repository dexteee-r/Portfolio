import type { MetadataRoute } from "next";
import { chapterIds } from "@/content/chapters";
import { pageIds } from "@/content/pages";
import type { Project } from "@/content/schema";
import { locales, type Locale } from "@/i18n/config";
import { chapterPath, homePath, pagePath, projectPath } from "@/i18n/paths";
import { absoluteUrl } from "./structured-data";

/**
 * Every public page, once per language, each naming all its language versions
 * (hreflang), as search engines expect. Only published projects: a draft has
 * no business in a sitemap even when a development build shows it.
 */
export function sitemapEntries(projects: Project[]): MetadataRoute.Sitemap {
  const pages: Array<(locale: Locale) => string> = [
    homePath,
    ...pageIds.map((page) => (locale: Locale) => pagePath(locale, page)),
    ...chapterIds.map((chapter) => (locale: Locale) => chapterPath(locale, chapter)),
    ...projects
      .filter((project) => project.status === "published")
      .map((project) => (locale: Locale) => projectPath(locale, project.chapter, project.slug)),
  ];

  return pages.flatMap((pathFor) => {
    const languages = Object.fromEntries(locales.map((locale) => [locale, absoluteUrl(pathFor(locale))]));
    return locales.map((locale) => ({
      url: absoluteUrl(pathFor(locale)),
      alternates: { languages },
    }));
  });
}

/** Everything may be crawled on the real site — except the CMS panel; nothing on a staging copy. */
export function robotsRules(indexable: boolean): MetadataRoute.Robots {
  return indexable
    ? {
        rules: { userAgent: "*", allow: "/", disallow: "/admin" },
        sitemap: absoluteUrl("/sitemap.xml"),
      }
    : { rules: { userAgent: "*", disallow: "/" } };
}
