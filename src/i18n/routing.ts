import { defaultLocale, isLocale, type Locale } from "./config";

/**
 * Set by the proxy on every page request: the locale of the URL. The global
 * 404 has no route params, so this is how it knows which language to speak.
 */
export const LOCALE_HEADER = "x-elmzn-locale";

/** Locale carried by the first path segment, or null. */
export function localeFromPathname(pathname: string): Locale | null {
  const first = pathname.split("/")[1] ?? "";
  return isLocale(first) ? first : null;
}

/**
 * Where a request without a valid locale prefix should go, or null when the
 * path is already localized.
 *
 * Deliberately ignores Accept-Language: a Belgian visitor whose browser is in
 * English must land on what they asked for, and crawlers must see the page
 * they requested. The visible language switcher is the only way to change.
 */
export function localeRedirectPath(pathname: string): string | null {
  const segments = pathname.split("/");
  const first = segments[1] ?? "";

  if (isLocale(first)) return null;

  // `/FR/dev` → `/fr/dev`: a miscased locale is still clearly that locale.
  const lowered = first.toLowerCase();
  if (isLocale(lowered)) {
    segments[1] = lowered;
    return segments.join("/");
  }

  if (pathname === "/" || pathname === "") return `/${defaultLocale}`;
  return `/${defaultLocale}${pathname}`;
}
