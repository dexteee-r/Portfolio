import type { Metadata } from "next";
import { headers } from "next/headers";
import { NotFoundView } from "@/components/NotFoundView";
import { countByChapter, loadProjects } from "@/content/projects";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { LOCALE_HEADER } from "@/i18n/routing";
import { site } from "@/site";
import { fontVariables } from "./fonts";
import "./globals.css";

/** The locale of the URL, as the proxy saw it; French when there is none. */
async function requestLocale(): Promise<Locale> {
  const value = (await headers()).get(LOCALE_HEADER) ?? "";
  return isLocale(value) ? value : defaultLocale;
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await requestLocale());
  return {
    metadataBase: new URL(site.url),
    title: `${dict.notFound.title} — ${site.brand}`,
    description: dict.notFound.body,
  };
}

/**
 * Every 404 of the site — unknown chapter, removed project, dead link — is
 * this one page, rendered in full on the server: readable without
 * JavaScript, in the language of the URL, with the four folders to leave by.
 *
 * It is a separate document from the [locale] layout, so its folders are
 * plain links: moving between two root layouts is always a full page load,
 * and the drawer could not play anyway.
 */
export default async function GlobalNotFound() {
  const locale = await requestLocale();
  return (
    <html lang={locale} className={fontVariables}>
      <body>
        <NotFoundView locale={locale} dict={getDictionary(locale)} counts={countByChapter(loadProjects())} />
      </body>
    </html>
  );
}
