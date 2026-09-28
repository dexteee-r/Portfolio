import { ImageResponse } from "next/og";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { CARD_SIZE, PageCard } from "@/seo/og/cards";
import { cardFonts } from "@/seo/og/fonts";
import { framePalette } from "@/seo/tokens";
import { site } from "@/site";

/** The legal notice's share card: the light frame, its title very large. */
export function legalCardMetadata(locale: Locale) {
  return [
    {
      id: "card",
      size: CARD_SIZE,
      contentType: "image/png",
      alt: `${getDictionary(locale).legal.title} — ${site.brand}`,
    },
  ];
}

export function legalCard(locale: Locale) {
  const copy = getDictionary(locale).legal;
  return new ImageResponse(
    <PageCard palette={framePalette()} eyebrow={site.brand} title={copy.title} subtitle={copy.description} />,
    { ...CARD_SIZE, fonts: cardFonts() },
  );
}
