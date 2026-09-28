import type { Locale } from "@/i18n/config";

/** Regional formats: Belgian French, British English — both 24-hour, day before month. */
export const FORMAT_LOCALE: Record<Locale, string> = {
  fr: "fr-BE",
  en: "en-GB",
};

/** `2026-09-28` → « 28 septembre 2026 », "28 September 2026". */
export function formatLongDate(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[locale], { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

/** `HH:MM`, 24-hour, in the given time zone. */
export function formatClock(date: Date, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[locale], {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

/** ISO-like `HH:MM` for the `dateTime` attribute of a `<time>` element. */
export function clockDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}
