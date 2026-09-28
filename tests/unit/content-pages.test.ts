import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chapterIds, chapterSlugs } from "@/content/chapters";
import { localeOfPageSlug, pageFromSlug, pageIds, pageSlugRedirects, pageSlugs } from "@/content/pages";
import { locales } from "@/i18n/config";
import { pagePath } from "@/i18n/paths";
import nextConfig from "../../next.config";

const APP = join(__dirname, "..", "..", "src", "app", "[locale]");

describe("frame pages", () => {
  it("have the slugs decided for them", () => {
    expect(pagePath("fr", "legal")).toBe("/fr/mentions-legales");
    expect(pagePath("en", "legal")).toBe("/en/legal-notice");
  });

  it("have URL-safe slugs that never collide with a chapter, nor with each other", () => {
    for (const locale of locales) {
      const pages = pageIds.map((id) => pageSlugs[id][locale]);
      const chapters = chapterIds.map((id) => chapterSlugs[id][locale]);
      expect(new Set([...pages, ...chapters]).size).toBe(pages.length + chapters.length);
      for (const slug of pages) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("round-trip through pageFromSlug and localeOfPageSlug", () => {
    for (const id of pageIds) {
      for (const locale of locales) {
        expect(pageFromSlug(locale, pageSlugs[id][locale])).toBe(id);
        expect(localeOfPageSlug(id, pageSlugs[id][locale])).toBe(locale);
      }
    }
    expect(pageFromSlug("en", "mentions-legales")).toBeNull();
    expect(pageFromSlug("fr", "dev")).toBeNull();
    expect(() => localeOfPageSlug("legal", "nope")).toThrow(/not a slug/);
  });

  it("each have a route folder per language, showing the page in that language", () => {
    for (const locale of locales) {
      const slug = pageSlugs.legal[locale];
      const file = join(APP, slug, "page.tsx");
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file, "utf8")).toContain(`legalLocale("${slug}")`);
    }
  });
});

describe("a page's slug under the wrong language", () => {
  it("redirects permanently to the page in the language of the URL", () => {
    expect(pageSlugRedirects()).toEqual(
      expect.arrayContaining([
        { source: "/en/mentions-legales", destination: "/en/legal-notice", permanent: true },
        { source: "/fr/legal-notice", destination: "/fr/mentions-legales", permanent: true },
      ]),
    );
  });

  it("never redirects a real page, and never into a loop", () => {
    const real = new Set(pageIds.flatMap((id) => locales.map((locale) => pagePath(locale, id))));
    for (const redirect of pageSlugRedirects()) {
      expect(real.has(redirect.source), redirect.source).toBe(false);
      expect(real.has(redirect.destination), redirect.destination).toBe(true);
    }
  });

  it("is wired into next.config", async () => {
    expect(await nextConfig.redirects!()).toEqual(pageSlugRedirects());
  });
});
