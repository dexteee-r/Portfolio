/**
 * The repair activity as a local business, for search engines. Filled in once
 * the activity is registered — see the legal notice in the roadmap. Until then
 * the site says nothing about an address it does not have.
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
  /** Registered company number, if any. */
  vatId?: string;
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
  /** Empty until the repair activity is registered: no LocalBusiness data is published. */
  repairBusiness: null as LocalBusinessInfo | null,
} as const;
