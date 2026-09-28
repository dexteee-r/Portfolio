import type { Metadata } from "next";
import { locales, type Locale } from "@/i18n/config";
import { languageAlternates } from "@/i18n/paths";
import { site } from "@/site";

/** Open Graph locale codes: Belgian French, British English. */
export const OG_LOCALE: Record<Locale, string> = {
  fr: "fr_BE",
  en: "en_GB",
};

/**
 * Whether search engines may index this build. A staging copy of the site
 * must never compete with the real one in results: build it with
 * SITE_NOINDEX=1. Read at build time — robots.txt and the pages are static.
 */
export function isIndexable(env: Record<string, string | undefined> = process.env): boolean {
  return env.SITE_NOINDEX !== "1";
}

/** `Alpha` → `Alpha — ELMZN`; the brand alone stays alone. */
export function withBrand(title: string): string {
  return title === site.brand || title.endsWith(` — ${site.brand}`) ? title : `${title} — ${site.brand}`;
}

interface PageMetadataInput {
  locale: Locale;
  /** The same page in any published locale. */
  pathFor: (locale: Locale) => string;
  /** Page title without the brand; the layout's template adds it to <title>. */
  title?: string;
  /** Used as is when no `title` is given (the desk). */
  absoluteTitle?: string;
  description: string;
  type?: "website" | "article";
}

/**
 * Everything a page tells search engines and link previews about itself:
 * canonical URL, every language version (hreflang), Open Graph and Twitter.
 * The share image comes from the route's opengraph-image file.
 */
export function pageMetadata({
  locale,
  pathFor,
  title,
  absoluteTitle,
  description,
  type = "website",
}: PageMetadataInput): Metadata {
  const shareTitle = absoluteTitle ?? withBrand(title ?? site.brand);
  const url = pathFor(locale);
  return {
    ...(absoluteTitle ? { title: { absolute: absoluteTitle } } : title ? { title } : {}),
    description,
    alternates: {
      canonical: url,
      languages: languageAlternates(pathFor),
    },
    openGraph: {
      type,
      siteName: site.brand,
      title: shareTitle,
      description,
      url,
      locale: OG_LOCALE[locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
    },
  };
}
