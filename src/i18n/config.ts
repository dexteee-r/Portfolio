/**
 * Locales the site publishes. Every one of them is prefixed in the URL,
 * including the default: `/` redirects to `/fr`, never to a guess.
 *
 * Adding a language = adding it here, adding its dictionary and its chapter
 * slugs. TypeScript refuses to compile until all three exist.
 */
export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

/**
 * Planned but not published. Dutch opens only once a native speaker has
 * proofread it — an approximate translation does more harm than none.
 */
export const plannedLocales = ["nl"] as const;

export const localeNames: Record<Locale, string> = {
  fr: "Français",
  en: "English",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
