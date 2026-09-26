import type { Locale } from "../config";
import { en } from "./en";
import { fr } from "./fr";

export type Dictionary = typeof fr;

const dictionaries: Record<Locale, Dictionary> = { fr, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/**
 * Picks the plural form with the locale's own rules and fills `{count}`.
 * French treats 0 as singular ("0 projet"), English does not ("0 projects").
 */
export function formatCount(
  locale: Locale,
  count: number,
  forms: { one: string; other: string },
): string {
  const rule = new Intl.PluralRules(locale).select(count);
  const template = rule === "one" ? forms.one : forms.other;
  return template.replaceAll("{count}", String(count));
}
