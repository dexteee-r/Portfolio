import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { homePath } from "@/i18n/paths";
import { site } from "@/site";
import { Clock } from "./Clock";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SiteLink } from "./SiteLink";

export interface TrailStep {
  /** A folder name, as it appears in the URL. */
  label: string;
  /** Absent on the last step: that is where the visitor is. */
  href?: string;
}

interface TopBarProps {
  locale: Locale;
  dict: Dictionary;
  /** Folders after ELMZN: `dev`, then `dev / mytgc`. */
  trail?: TrailStep[];
  /** Plain anchors, for pages outside the app (the global 404). */
  plain?: boolean;
}

/**
 * ELMZN on the left, system information on the right. Achromatic in every
 * grade. Inside a chapter it reads as a path — `ELMZN / dev / mytgc` — which
 * is also the discreet way back up.
 */
export function TopBar({ locale, dict, trail = [], plain = false }: TopBarProps) {
  const home = (
    <SiteLink
      plain={plain}
      href={homePath(locale)}
      aria-label={dict.topBar.homeLabel}
      className="font-medium text-chapter-ink"
    >
      {site.brand}
    </SiteLink>
  );

  return (
    <header className="border-b border-chapter-line font-mono text-2xs uppercase tracking-label text-chapter-muted">
      <div className="flex h-12 items-center justify-between gap-6 px-gutter">
        {trail.length > 0 ? (
          <nav aria-label={dict.topBar.breadcrumbLabel} className="min-w-0">
            <ol className="flex min-w-0 items-center gap-2">
              <li className="shrink-0">{home}</li>
              {trail.map((step, index) => {
                const last = index === trail.length - 1;
                // Deep in the tree on a phone, the page's own title says where
                // you are: the last step gives way to the language and clock.
                const deep = last && index > 0;
                return (
                  <li
                    key={step.label}
                    aria-current={last ? "page" : undefined}
                    className={`normal-case tracking-normal ${
                      last ? "min-w-0 truncate text-chapter-ink" : "shrink-0"
                    } ${deep ? "hidden sm:block" : ""}`}
                  >
                    <span aria-hidden="true" className="mr-2 text-chapter-muted">
                      /
                    </span>
                    {step.href && !last ? (
                      <SiteLink plain={plain} href={step.href} className="text-chapter-muted hover:text-chapter-ink">
                        {step.label}
                      </SiteLink>
                    ) : (
                      step.label
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : (
          home
        )}
        <div className="flex shrink-0 items-center gap-4 sm:gap-6">
          <LanguageSwitcher locale={locale} label={dict.language.label} plain={plain} />
          <span className="hidden sm:inline">{dict.topBar.location}</span>
          <Clock locale={locale} timeZone={site.timeZone} label={dict.topBar.clockLabel} />
        </div>
      </div>
    </header>
  );
}
