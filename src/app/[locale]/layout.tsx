import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { ViewStage } from "@/components/ViewStage";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { bootScript } from "@/lib/boot";
import { isIndexable } from "@/seo/metadata";
import { framePalette } from "@/seo/tokens";
import { site } from "@/site";
import { fontVariables } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** Only published locales exist; anything else is the global 404. */
export const dynamicParams = false;

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    metadataBase: new URL(site.url),
    title: { default: dict.meta.title, template: `%s — ${site.brand}` },
    description: dict.meta.description,
    applicationName: site.brand,
    // Preview deployments must never compete with the real site in results.
    ...(isIndexable() ? {} : { robots: { index: false, follow: false } }),
  };
}

/** The browser's own chrome takes the frame's ground; chapters override it with theirs. */
export function generateViewport(): Viewport {
  return { themeColor: framePalette().bg };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    // The boot script sets data-boot on <html> before React hydrates it.
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <body>
        {/* First in <body>: runs while the HTML is parsed, before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: bootScript() }} />
        <ViewStage>{children}</ViewStage>
      </body>
    </html>
  );
}
