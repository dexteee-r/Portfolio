import type { LocalizedProject } from "@/content/projects";
import { locales } from "@/i18n/config";
import { site, type LocalBusinessInfo } from "@/site";

/**
 * schema.org data, as JSON-LD. Search engines read who the site is about, how
 * pages nest, and what each project is — facts already visible on the page,
 * never anything the visitor cannot see.
 */

export type JsonLd = Record<string, unknown>;

const PERSON_ID = `${site.url}/#person`;
const WEBSITE_ID = `${site.url}/#website`;

export function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString();
}

/** Public profiles that are actually filled in; an empty one is left out. */
export function knownProfiles(social: Record<string, string> = site.social): string[] {
  return Object.values(social).filter((url) => url !== "");
}

/** The owner of the site. */
export function personLd(jobTitle: string): JsonLd {
  const profiles = knownProfiles();
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: site.ownerName,
    url: site.url,
    jobTitle,
    email: `mailto:${site.email}`,
    address: { "@type": "PostalAddress", addressCountry: site.country },
    ...(profiles.length > 0 ? { sameAs: profiles } : {}),
  };
}

/** The site itself, published by its owner, in every published language. */
export function websiteLd(): JsonLd {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: site.brand,
    url: site.url,
    inLanguage: [...locales],
    publisher: { "@id": PERSON_ID },
  };
}

/** The path from the desk to the page: ELMZN › Développement › Alpha. */
export function breadcrumbLd(items: Array<{ name: string; path: string }>): JsonLd {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** A project, as the page presents it. */
export function projectLd(project: LocalizedProject, path: string): JsonLd {
  return {
    "@type": "CreativeWork",
    "@id": `${absoluteUrl(path)}#project`,
    name: project.title,
    ...(project.summary ? { description: project.summary } : {}),
    url: absoluteUrl(path),
    inLanguage: project.lang,
    ...(project.cover ? { image: absoluteUrl(project.cover) } : {}),
    ...(project.year !== undefined ? { dateCreated: String(project.year) } : {}),
    ...(project.stack.length > 0 ? { keywords: project.stack.join(", ") } : {}),
    author: { "@id": PERSON_ID },
    isPartOf: { "@id": WEBSITE_ID },
  };
}

/**
 * The repair activity as a local business — only once its details exist.
 * Returns null until then: no invented address, no placeholder data.
 */
export function localBusinessLd(
  business: LocalBusinessInfo | null,
  description: string,
  path: string,
): JsonLd | null {
  if (!business) return null;
  return {
    "@type": "LocalBusiness",
    "@id": `${absoluteUrl(path)}#business`,
    name: business.name,
    description,
    url: absoluteUrl(path),
    email: `mailto:${business.email}`,
    ...(business.telephone ? { telephone: business.telephone } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: business.street,
      postalCode: business.postalCode,
      addressLocality: business.locality,
      addressCountry: business.country,
    },
    ...(business.areaServed?.length ? { areaServed: business.areaServed } : {}),
    ...(business.openingHours?.length ? { openingHours: business.openingHours } : {}),
    ...(business.vatId ? { vatID: business.vatId } : {}),
    founder: { "@id": PERSON_ID },
  };
}

/** One JSON-LD document holding several entities. */
export function graph(...items: Array<JsonLd | null>): JsonLd {
  return { "@context": "https://schema.org", "@graph": items.filter((item): item is JsonLd => item !== null) };
}

/**
 * Serialised for a <script> element. `<` is escaped so no string in the data —
 * a project title, say — can ever close the script tag.
 */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
