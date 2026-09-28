import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { pagePath } from "@/i18n/paths";
import { site } from "@/site";
import { BrandIcon, MailIcon, type Brand } from "./ContactIcons";
import { SiteLink } from "./SiteLink";

type Profile = keyof typeof site.social;

/** Profile names are brands: the same in every language. Each has its icon. */
const PROFILES: Record<Profile, { name: string; icon: Brand }> = {
  instagram: { name: "Instagram", icon: "instagram" },
  github: { name: "GitHub", icon: "github" },
};

/** Public profiles that are filled in, with their names. An empty one is left out. */
export function profileLinks(
  social: Record<Profile, string> = site.social,
): Array<{ name: string; url: string; icon: Brand }> {
  return (Object.keys(social) as Profile[])
    .filter((key) => social[key] !== "")
    .map((key) => ({ ...PROFILES[key], url: social[key] }));
}

/** Small enough to sit with the footer's small capitals, never above them. */
const ICON = "size-3.5 shrink-0";

interface SiteFooterProps {
  locale: Locale;
  dict: Dictionary;
  /** The way back up, first in the footer: a chapter to the desk, a project to its chapter. */
  back?: ReactNode;
  /** On the legal notice itself, its link says so. */
  current?: "legal";
  /** Plain anchors, for pages outside the app (the global 404). */
  plain?: boolean;
}

/**
 * The foot of every page: the way back up, then how to reach the owner —
 * the address in clear and clickable, no form and no obfuscation (a script
 * that hides it breaks screen readers and no longer stops spam) — and the
 * legal notice. Achromatic in every grade.
 */
export function SiteFooter({ locale, dict, back, current, plain = false }: SiteFooterProps) {
  const link = "text-chapter-ink underline-offset-4 hover:underline";

  return (
    <footer
      id="contact"
      className="border-t border-chapter-line px-gutter py-6 font-mono text-2xs uppercase tracking-label text-chapter-muted"
    >
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-baseline md:justify-between md:gap-x-10">
        {back && <div>{back}</div>}
        {/* A heading may not sit inside <address>: it labels it from outside. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <h2 className="font-mono text-2xs font-normal">{dict.footer.contact}</h2>
          <address className="flex flex-wrap items-center gap-x-5 gap-y-2 not-italic">
            <a
              href={`mailto:${site.email}`}
              className={`${link} inline-flex items-center gap-1.5 normal-case tracking-normal`}
            >
              <MailIcon className={ICON} />
              {site.email}
            </a>
            {profileLinks().map((profile) => (
              <a key={profile.url} href={profile.url} rel="me" className={`${link} inline-flex items-center gap-1.5`}>
                <BrandIcon brand={profile.icon} className={ICON} />
                {profile.name}
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </address>
        </div>
        <SiteLink
          plain={plain}
          href={pagePath(locale, "legal")}
          aria-current={current === "legal" ? "page" : undefined}
          className={link}
        >
          {dict.footer.legal}
        </SiteLink>
      </div>
    </footer>
  );
}
