"use client";

import { usePathname } from "next/navigation";
import { localeNames, locales, type Locale } from "@/i18n/config";
import { switchLocalePath } from "@/i18n/paths";
import { SiteLink } from "./SiteLink";

interface LanguageSwitcherProps {
  locale: Locale;
  label: string;
  /** Plain anchors, for pages outside the app (the global 404). */
  plain?: boolean;
}

/**
 * The only way to change language — the site never guesses from the browser.
 * Each link leads to the same page in the other language.
 */
export function LanguageSwitcher({ locale, label, plain = false }: LanguageSwitcherProps) {
  const pathname = usePathname() ?? `/${locale}`;

  return (
    <nav aria-label={label}>
      <ul className="flex items-center gap-3">
        {locales.map((target) => {
          const current = target === locale;
          return (
            <li key={target}>
              <SiteLink
                plain={plain}
                href={switchLocalePath(pathname, target)}
                hrefLang={target}
                lang={target}
                aria-current={current ? "true" : undefined}
                className={current ? "text-chapter-ink" : "text-chapter-muted hover:text-chapter-ink"}
              >
                <span className={current ? "underline decoration-1 underline-offset-4" : undefined}>
                  {target.toUpperCase()}
                </span>{" "}
                <span className="sr-only">{localeNames[target]}</span>
              </SiteLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
