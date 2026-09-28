import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { LegalView } from "@/components/LegalView";
import { localeOfPageSlug } from "@/content/pages";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { homePath, pagePath } from "@/i18n/paths";
import { pageMetadata } from "@/seo/metadata";
import { breadcrumbLd, graph } from "@/seo/structured-data";
import { site } from "@/site";

/**
 * The legal notice lives in one route folder per language, named after its
 * slug (`mentions-legales`, `legal-notice`). This private folder holds what
 * they share; each folder only fixes its language, from its own name. (Under
 * the other language's prefix, the folder is never shown: next.config.ts
 * redirects it to the right slug.)
 */
export function legalLocale(folder: string): Locale {
  return localeOfPageSlug("legal", folder);
}

export function legalMetadata(locale: Locale): Metadata {
  const copy = getDictionary(locale).legal;
  return pageMetadata({
    locale,
    pathFor: (l) => pagePath(l, "legal"),
    title: copy.title,
    description: copy.description,
  });
}

export function LegalPage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbLd([
            { name: site.brand, path: homePath(locale) },
            { name: dict.legal.title, path: pagePath(locale, "legal") },
          ]),
        )}
      />
      <LegalView locale={locale} dict={dict} />
    </>
  );
}
