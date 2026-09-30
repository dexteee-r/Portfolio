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

/**
 * A length of work, the way a workshop ticket writes it: `45 min`, `2 h`,
 * « 2 h 30 », "2 h 30 min".
 */
export function formatDuration(minutes: number, locale: Locale): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return locale === "fr" ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h ${rest} min`;
}

/** The same length as an ISO 8601 duration, for a `<time dateTime>`: `PT2H30M`. */
export function durationDateTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `PT${hours ? `${hours}H` : ""}${rest || !hours ? `${rest}M` : ""}`;
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
