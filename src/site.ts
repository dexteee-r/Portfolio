/**
 * The repair activity as a local business, for search engines and the legal
 * notice. Filled in once the activity is registered — see the roadmap. Until
 * then the site says nothing about an address it does not have.
 */
export interface LocalBusinessInfo {
  name: string;
  email: string;
  telephone?: string;
  street: string;
  postalCode: string;
  locality: string;
  /** ISO 3166-1 alpha-2, e.g. "BE". */
  country: string;
  /** Places served, e.g. ["Bruxelles", "Wavre"]. */
  areaServed?: string[];
  /** schema.org openingHours, e.g. ["Mo-Fr 10:00-18:00"]. */
  openingHours?: string[];
  /** Enterprise number from the Crossroads Bank for Enterprises (BCE/KBO), e.g. "0123.456.789". */
  enterpriseNumber: string;
  /** VAT number, only if the activity is subject to VAT, e.g. "BE0123456789". */
  vatId?: string;
}

/** A company named on the legal notice: who carries the site's mail. */
export interface Provider {
  name: string;
  /** Street address, without the country. */
  address?: string;
  /** ISO 3166-1 alpha-2; the country's name is written in the page's language. */
  country: string;
  url: string;
  /** Its own privacy policy, linked from the privacy note. */
  privacyPolicy?: string;
}

/** Facts about the site and its owner. One place, no duplicates in components. */
export const site = {
  brand: "ELMZN",
  ownerName: "Markus",
  url: "https://elmzn.be",
  email: "contact@elmzn.be",
  /** Clock in the top bar and any date shown to visitors. */
  timeZone: "Europe/Brussels",
  country: "BE",
  /** Public profiles. Only known ones: an empty value is left out everywhere. */
  social: {
    instagram: "https://www.instagram.com/dexteeer.labo/",
    github: "https://github.com/dexteee-r",
  },
  /** The site's own code, public. */
  sourceCode: "https://github.com/dexteee-r/Portfolio",
  /** Who publishes the site, as the legal notice names them: a private person. */
  publisher: {
    name: "Mohamed Mokhtar El Mazani",
  },
  /** Empty until the repair activity is registered: no business details are published. */
  repairBusiness: null as LocalBusinessInfo | null,
  /**
   * Self-hosted: the publisher's own server, a homelab in Belgium, behind
   * Nginx Proxy Manager. No hosting company sees the visits.
   */
  hosting: {
    country: "BE",
  },
  /**
   * The server's request logs (IP address, page, browser) are gone after this
   * many weeks at most. Nginx Proxy Manager's defaults: access logs rotated
   * weekly with 4 kept, error logs with 10 kept — 11 weeks. Change the
   * rotation and this number together: the privacy note promises it.
   */
  serverLogRetentionWeeks: 11,
  /**
   * Receives the mail sent to `email` (the domain's MX records). Its plan has
   * no mailbox: a redirection forwards every message to `mailInbox`.
   */
  mailHost: {
    name: "OVHcloud",
    country: "FR",
    url: "https://www.ovhcloud.com",
  } satisfies Provider,
  /**
   * Where the redirection delivers: the publisher's own Gmail inbox. Google
   * Ireland serves users in the EEA; Google may process mail outside the EU,
   * and the privacy note says so. The inbox's address is never published.
   */
  mailInbox: {
    name: "Google",
    country: "IE",
    url: "https://www.google.com/gmail/about/",
    privacyPolicy: "https://policies.google.com/privacy",
  } satisfies Provider,
  /**
   * Messages sent to `email` are deleted this many months after the last
   * exchange. The privacy note promises it: keep the mailbox to it.
   */
  emailRetentionMonths: 12,
  /** When the legal notice and privacy note were last revised (ISO date). */
  legalUpdated: "2026-10-05",
} as const;
