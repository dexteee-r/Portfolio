import type { ReactNode } from "react";
import { pageSlugs } from "@/content/pages";
import type { Locale } from "@/i18n/config";
import { formatCount, type Dictionary } from "@/i18n/dictionaries";
import { homePath } from "@/i18n/paths";
import { interpolate } from "@/lib/interpolate";
import { FORMAT_LOCALE, formatLongDate } from "@/lib/time";
import { site, type LocalBusinessInfo } from "@/site";
import { SiteFooter } from "./SiteFooter";
import { SiteLink } from "./SiteLink";
import { SkipLink } from "./SkipLink";
import { TopBar } from "./TopBar";

interface LegalViewProps {
  locale: Locale;
  dict: Dictionary;
  /** The registered repair business, once there is one; until then the site is a private person's. */
  business?: LocalBusinessInfo | null;
}

/** A country's name in the page's language: `US` → « États-Unis », "United States". */
export function countryName(locale: Locale, code: string): string {
  return new Intl.DisplayNames([FORMAT_LOCALE[locale]], { type: "region" }).of(code) ?? code;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-6 sm:grid-cols-[12rem_1fr]">
      <dt className="font-mono text-2xs uppercase tracking-label text-chapter-muted sm:pt-1">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * The legal notice and the privacy note, on the frame beside the desk: who
 * publishes the site, who hosts it, what it keeps about its visitors. Every
 * fact comes from `src/site.ts`; the business details appear on their own
 * once `site.repairBusiness` is filled in.
 */
export function LegalView({ locale, dict, business = site.repairBusiness }: LegalViewProps) {
  const copy = dict.legal;
  const mail = <a href={`mailto:${site.email}`}>{site.email}</a>;

  return (
    <div data-view="frame" className="flex min-h-dvh flex-col bg-chapter-bg">
      <SkipLink label={dict.skipLink} />
      <TopBar locale={locale} dict={dict} trail={[{ label: pageSlugs.legal[locale] }]} />

      <main id="content" className="flex-1 px-gutter pt-12 pb-16 md:pt-20 md:pb-24">
        <article className="max-w-measure">
          <header>
            <h1
              data-view-title=""
              tabIndex={-1}
              className="text-3xl font-semibold leading-tight tracking-display text-chapter-ink hyphens-auto wrap-break-word md:text-4xl"
            >
              {copy.title}
            </h1>
            <p className="mt-6 text-lg leading-snug text-chapter-muted">{copy.description}</p>
            <p className="mt-4 font-mono text-2xs uppercase tracking-label text-chapter-muted">
              {interpolate(copy.updated, {
                date: <time dateTime={site.legalUpdated}>{formatLongDate(site.legalUpdated, locale)}</time>,
              })}
            </p>
          </header>

          <div className="prose mt-12 md:mt-16">
            <h2>{copy.publisherHeading}</h2>
            <dl className="flex flex-col gap-3">
              <Fact label={copy.publisherLabel}>{interpolate(copy.publisherValue, { name: site.publisher.name })}</Fact>
              <Fact label={copy.contactLabel}>{mail}</Fact>
              {business ? (
                <>
                  <Fact label={copy.businessLabel}>{business.name}</Fact>
                  <Fact label={copy.addressLabel}>
                    {business.street}, {business.postalCode} {business.locality},{" "}
                    {countryName(locale, business.country)}
                  </Fact>
                  <Fact label={copy.enterpriseNumberLabel}>{business.enterpriseNumber}</Fact>
                  {business.vatId && <Fact label={copy.vatLabel}>{business.vatId}</Fact>}
                </>
              ) : (
                <Fact label={copy.countryLabel}>{countryName(locale, site.country)}</Fact>
              )}
            </dl>
            {!business && <p>{copy.personal}</p>}

            <h2>{copy.hostingHeading}</h2>
            <p>{interpolate(copy.hosting, { country: countryName(locale, site.hosting.country) })}</p>

            <h2>{copy.privacyHeading}</h2>
            <p>{interpolate(copy.controller, { name: site.publisher.name, email: mail })}</p>

            <h3>{copy.noTrackingHeading}</h3>
            <p>{copy.noTracking}</p>

            <h3>{copy.storageHeading}</h3>
            <p>{copy.storage}</p>

            <h3>{copy.logsHeading}</h3>
            <p>
              {interpolate(copy.logs, {
                retention: formatCount(locale, site.serverLogRetentionWeeks, copy.logRetention),
              })}
            </p>

            <h3>{copy.mailHeading}</h3>
            <p>
              {interpolate(copy.mail, {
                email: mail,
                mailHost: site.mailHost.name,
                mailCountry: countryName(locale, site.mailHost.country),
                retention: formatCount(locale, site.emailRetentionMonths, copy.mailRetention),
              })}
            </p>

            <h3>{copy.rightsHeading}</h3>
            <p>
              {interpolate(copy.rights, {
                email: mail,
                authority: <a href={copy.authorityUrl}>{copy.authority}</a>,
              })}
            </p>

            <h2>{copy.contentHeading}</h2>
            <p>
              {interpolate(copy.content, {
                name: site.publisher.name,
                source: <a href={site.sourceCode}>{copy.sourceLink}</a>,
              })}
            </p>
          </div>
        </article>
      </main>

      <SiteFooter
        locale={locale}
        dict={dict}
        current="legal"
        back={
          <>
            <SiteLink href={homePath(locale)} className="text-chapter-ink hover:underline">
              <span aria-hidden="true">← </span>
              {dict.chapterPage.backToDesk}
            </SiteLink>
            <span aria-hidden="true" className="hidden pointer-fine:inline">
              {" · "}
              <kbd className="font-mono">{dict.chapterPage.escapeHint}</kbd>
            </span>
          </>
        }
      />
    </div>
  );
}
