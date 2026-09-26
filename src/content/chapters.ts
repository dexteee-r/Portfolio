import type { Locale } from "@/i18n/config";

/**
 * The four chapters. Their ids match `data-chapter` in tokens.css, so this
 * list and the stylesheet must never drift apart — a unit test enforces it.
 * Order here is the order on the desk.
 */
export const chapterIds = ["dev", "infra", "repair", "creative"] as const;
export type ChapterId = (typeof chapterIds)[number];

/** URL segment of each chapter, per locale. `/fr/creatif`, `/en/creative`. */
export const chapterSlugs: Record<ChapterId, Record<Locale, string>> = {
  dev: { fr: "dev", en: "dev" },
  infra: { fr: "infra", en: "infra" },
  repair: { fr: "repair", en: "repair" },
  creative: { fr: "creatif", en: "creative" },
};

export function isChapterId(value: string): value is ChapterId {
  return (chapterIds as readonly string[]).includes(value);
}

export function chapterFromSlug(locale: Locale, slug: string): ChapterId | null {
  return chapterIds.find((id) => chapterSlugs[id][locale] === slug) ?? null;
}
