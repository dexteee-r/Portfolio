import { ImageResponse } from "next/og";
import { chapterFromSlug } from "@/content/chapters";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { CARD_SIZE, PageCard } from "@/seo/og/cards";
import { cardFonts } from "@/seo/og/fonts";
import { chapterPalette } from "@/seo/tokens";
import { site } from "@/site";

export const contentType = "image/png";

function resolve(params: { locale: string; chapter: string }) {
  const locale = isLocale(params.locale) ? params.locale : defaultLocale;
  const chapter = chapterFromSlug(locale, params.chapter);
  return chapter ? { locale, chapter } : null;
}

export function generateImageMetadata({ params }: { params: { locale: string; chapter: string } }) {
  const resolved = resolve(params);
  if (!resolved) return [];
  const copy = getDictionary(resolved.locale).chapters[resolved.chapter];
  return [{ id: "card", size: CARD_SIZE, contentType, alt: `${copy.name} — ${site.brand}` }];
}

/** A chapter: its grade, its name very large, what it holds underneath. */
export default async function ChapterShareCard({
  params,
}: {
  params: Promise<{ locale: string; chapter: string }>;
}) {
  const resolved = resolve(await params);
  if (!resolved) return new Response(null, { status: 404 });
  const copy = getDictionary(resolved.locale).chapters[resolved.chapter];
  return new ImageResponse(
    <PageCard palette={chapterPalette(resolved.chapter)} eyebrow={site.brand} title={copy.name} subtitle={copy.description} />,
    { ...CARD_SIZE, fonts: cardFonts() },
  );
}
