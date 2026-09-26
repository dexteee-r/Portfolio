import { ImageResponse } from "next/og";
import { chapterIds } from "@/content/chapters";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { CARD_SIZE, DeskCard } from "@/seo/og/cards";
import { cardFonts } from "@/seo/og/fonts";
import { framePalette, markColor } from "@/seo/tokens";
import { site } from "@/site";

export const contentType = "image/png";

/** One card per language, described in that language. */
export function generateImageMetadata({ params }: { params: { locale: string } }) {
  const locale = isLocale(params.locale) ? params.locale : defaultLocale;
  return [
    {
      id: "card",
      size: CARD_SIZE,
      contentType,
      alt: `${site.ownerName} — ${getDictionary(locale).desk.identity}`,
    },
  ];
}

export default async function DeskShareCard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  const locale = isLocale(requested) ? requested : defaultLocale;
  const dict = getDictionary(locale);
  return new ImageResponse(
    <DeskCard
      palette={framePalette()}
      name={site.ownerName}
      identity={dict.desk.identity}
      marks={chapterIds.map((id) => markColor(id))}
    />,
    { ...CARD_SIZE, fonts: cardFonts() },
  );
}
