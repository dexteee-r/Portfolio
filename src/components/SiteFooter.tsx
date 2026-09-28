import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { pagePath } from "@/i18n/paths";
import { site } from "@/site";
import { SiteLink } from "./SiteLink";

/** Profile names are brands: the same in every language. */
const PROFILE_NAMES: Record<Profile, string> = {
  instagram: "Instagram",
  github: "GitHub",
};

type Profile = keyof typeof site.social;

/** Public profiles that are filled in, with their names. An empty one is left out. */
export function profileLinks(social: Record<Profile, string> = site.social): Array<{ name: string; url: string }> {
  return (Object.keys(social) as Profile[])
    .filter((key) => social[key] !== "")
    .map((key) => ({ name: PROFILE_NAMES[key], url: social[key] }));
}

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
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <h2 className="font-mono text-2xs font-normal">{dict.footer.contact}</h2>
          <address className="flex flex-wrap items-baseline gap-x-5 gap-y-2 not-italic">
            <a href={`mailto:${site.email}`} className={`${link} normal-case tracking-normal`}>
              {site.email}
            </a>
            {profileLinks().map((profile) => (
              <a key={profile.url} href={profile.url} rel="me" className={link}>
                {profile.name}
                <span aria-hidden="true"> ↗</span>
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
