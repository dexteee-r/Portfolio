// Relative import: next.config.ts reads this file, without the "@/" alias.
import { locales, type Locale } from "../i18n/config";

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
  infra: { fr: "homelab", en: "homelab" },
  repair: { fr: "repair", en: "repair" },
  creative: { fr: "creatif", en: "creative" },
};

/**
 * Segments a chapter was once published under: the infra chapter lived at
 * `/fr/infra` until it took the homelab's name. Old links keep working.
 */
export const formerChapterSlugs: Partial<Record<ChapterId, string[]>> = {
  infra: ["infra"],
};

/**
 * Projects renamed after publication: the homelab's own project lived at
 * /fr/homelab/homelab until it became /fr/homelab/machines. Old links keep working.
 */
export const movedProjects: ReadonlyArray<{ chapter: ChapterId; from: string; to: string }> = [
  { chapter: "infra", from: "homelab", to: "machines" },
];

export interface PathRedirect {
  source: string;
  destination: string;
  permanent: true;
}

/**
 * Permanent redirects from a moved project's former name, under its chapter's
 * current segment and each former one — straight to the new address, in one hop.
 */
export function movedProjectRedirects(): PathRedirect[] {
  return movedProjects.flatMap(({ chapter, from, to }) =>
    locales.flatMap((locale) => {
      const current = chapterSlugs[chapter][locale];
      return [current, ...(formerChapterSlugs[chapter] ?? [])].map((segment) => ({
        source: `/${locale}/${segment}/${from}`,
        destination: `/${locale}/${current}/${to}`,
        permanent: true as const,
      }));
    }),
  );
}

/** Permanent redirects from a chapter's former segments, for it and its projects. */
export function chapterSlugRedirects(): PathRedirect[] {
  return chapterIds.flatMap((chapter) =>
    (formerChapterSlugs[chapter] ?? []).flatMap((former) =>
      locales.flatMap((locale) => {
        const current = chapterSlugs[chapter][locale];
        return [
          { source: `/${locale}/${former}`, destination: `/${locale}/${current}`, permanent: true as const },
          { source: `/${locale}/${former}/:project`, destination: `/${locale}/${current}/:project`, permanent: true as const },
        ];
      }),
    ),
  );
}

export function isChapterId(value: string): value is ChapterId {
  return (chapterIds as readonly string[]).includes(value);
}

export function chapterFromSlug(locale: Locale, slug: string): ChapterId | null {
  return chapterIds.find((id) => chapterSlugs[id][locale] === slug) ?? null;
}
