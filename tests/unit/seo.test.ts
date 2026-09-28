import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifest from "@/app/manifest";
import { chapterIds } from "@/content/chapters";
import { loadProjects, localizeProject } from "@/content/projects";
import type { LocalizedProject } from "@/content/projects";
import { locales } from "@/i18n/config";
import { chapterPath, homePath } from "@/i18n/paths";
import { ICON_SIZES, iconPath } from "@/seo/icons";
import { isIndexable, OG_LOCALE, pageMetadata, withBrand } from "@/seo/metadata";
import {
  CONTENT_WIDTH,
  iconStroke,
  SAFE_SQUARE,
  TITLE_MAX,
  TITLE_MIN,
  titleLines,
  titleSize,
  titleWidth,
} from "@/seo/og/cards";
import { getDictionary } from "@/i18n/dictionaries";
import { robotsRules, sitemapEntries } from "@/seo/sitemap";
import {
  absoluteUrl,
  breadcrumbLd,
  graph,
  knownProfiles,
  localBusinessLd,
  personLd,
  projectLd,
  serializeJsonLd,
  websiteLd,
} from "@/seo/structured-data";
import { chapterPalette, framePalette, markColor, parseTokens, tokenColor } from "@/seo/tokens";
import { site } from "@/site";

const ROOT = join(__dirname, "..", "..");
const FIXTURES = join(ROOT, "tests", "fixtures", "content");
const tokensCss = readFileSync(join(ROOT, "src", "styles", "tokens.css"), "utf8");

describe("tokens for images", () => {
  it("reads the real values from tokens.css — the single source", () => {
    expect(tokenColor("--color-ground")).toBe("#f6f6f4");
    expect(chapterPalette("dev").bg).toBe("#0d0f1f");
    expect(markColor("repair")).toBe("#b23d26");
  });

  it("gives the frame no colour of its own: its accent is its ink", () => {
    const frame = framePalette();
    expect(frame.accent).toBe(frame.ink);
  });

  it("has a full palette for every chapter", () => {
    for (const id of chapterIds) {
      for (const value of Object.values(chapterPalette(id))) expect(value, id).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("refuses a missing token or one that is not a plain colour", () => {
    const parsed = parseTokens(tokensCss);
    expect(() => tokenColor("--nope", parsed)).toThrow(/has no --nope/);
    expect(() => tokenColor("--chapter-bg", parsed)).toThrow(/not a #rrggbb/);
  });

  it("ignores values that only appear in comments", () => {
    const parsed = parseTokens(":root { /* --ghost: #fff; */ --real: #000000; }");
    expect([...parsed.keys()]).toEqual(["--real"]);
  });
});

describe("metadata", () => {
  it("indexes every build, except a staging copy built with SITE_NOINDEX=1", () => {
    expect(isIndexable({})).toBe(true);
    expect(isIndexable({ SITE_NOINDEX: "0" })).toBe(true);
    expect(isIndexable({ SITE_NOINDEX: "1" })).toBe(false);
  });

  it("adds the brand to share titles once", () => {
    expect(withBrand("Alpha")).toBe("Alpha — ELMZN");
    expect(withBrand("Alpha — ELMZN")).toBe("Alpha — ELMZN");
    expect(withBrand("ELMZN")).toBe("ELMZN");
  });

  it("describes a chapter completely: canonical, every language, Open Graph, Twitter", () => {
    const meta = pageMetadata({
      locale: "en",
      pathFor: (l) => chapterPath(l, "creative"),
      title: "Creative",
      description: "Audiovisual work.",
    });
    expect(meta.title).toBe("Creative");
    expect(meta.alternates).toEqual({
      canonical: "/en/creative",
      languages: { fr: "/fr/creatif", en: "/en/creative", "x-default": "/fr/creatif" },
    });
    expect(meta.openGraph).toMatchObject({
      type: "website",
      siteName: "ELMZN",
      title: "Creative — ELMZN",
      description: "Audiovisual work.",
      url: "/en/creative",
      locale: "en_GB",
      alternateLocale: ["fr_BE"],
    });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: "Creative — ELMZN" });
  });

  it("keeps the desk's full title as is, without the template", () => {
    const meta = pageMetadata({ locale: "fr", pathFor: homePath, absoluteTitle: "ELMZN — tout", description: "d" });
    expect(meta.title).toEqual({ absolute: "ELMZN — tout" });
    expect(meta.openGraph).toMatchObject({ title: "ELMZN — tout", locale: "fr_BE" });
  });

  it("has an Open Graph locale for every published language", () => {
    for (const locale of locales) expect(OG_LOCALE[locale]).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
  });
});

describe("structured data", () => {
  const project = (overrides: Partial<LocalizedProject> = {}): LocalizedProject => ({
    slug: "alpha-app",
    chapter: "dev",
    status: "published",
    title: "Alpha",
    summary: "Une application.",
    lang: "fr",
    body: "",
    bodyLang: "fr",
    cover: "/media/fixtures/alpha-cover.webp",
    coverAlt: "x",
    year: 2025,
    links: [],
    ...overrides,
  });

  it("describes the owner with the facts the site states, and only known profiles", () => {
    const person = personLd("Développeur full-stack et infrastructure");
    expect(person).toMatchObject({
      "@type": "Person",
      name: site.ownerName,
      url: site.url,
      email: `mailto:${site.email}`,
      address: { addressCountry: "BE" },
      sameAs: [site.social.instagram, site.social.github],
    });
    expect(person.sameAs).not.toContain("");
  });

  it("leaves out a profile that is not filled in", () => {
    expect(knownProfiles({ instagram: "https://instagram.com/x", github: "" })).toEqual(["https://instagram.com/x"]);
    expect(knownProfiles({ github: "" })).toEqual([]);
  });

  it("links profiles that are real https addresses", () => {
    for (const url of knownProfiles()) expect(new URL(url).protocol, url).toBe("https:");
  });

  it("describes the site in both languages, published by its owner", () => {
    expect(websiteLd()).toMatchObject({ "@type": "WebSite", name: "ELMZN", inLanguage: ["fr", "en"] });
    expect((websiteLd().publisher as { "@id": string })["@id"]).toBe(personLd("x")["@id"]);
  });

  it("builds breadcrumbs with absolute URLs, numbered from 1", () => {
    const crumbs = breadcrumbLd([
      { name: "ELMZN", path: "/fr" },
      { name: "Développement", path: "/fr/dev" },
    ]);
    expect(crumbs.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "ELMZN", item: "https://elmzn.be/fr" },
      { "@type": "ListItem", position: 2, name: "Développement", item: "https://elmzn.be/fr/dev" },
    ]);
  });

  it("describes a project, leaving out what it does not have", () => {
    expect(projectLd(project(), "/fr/dev/alpha-app")).toMatchObject({
      "@type": "CreativeWork",
      name: "Alpha",
      description: "Une application.",
      url: "https://elmzn.be/fr/dev/alpha-app",
      inLanguage: "fr",
      image: "https://elmzn.be/media/fixtures/alpha-cover.webp",
      dateCreated: "2025",
    });
    const bare = projectLd(project({ cover: undefined, year: undefined, summary: "" }), "/fr/dev/x");
    expect(bare).not.toHaveProperty("image");
    expect(bare).not.toHaveProperty("dateCreated");
    expect(bare).not.toHaveProperty("description");
  });

  it("states the language a project is actually written in", () => {
    expect(projectLd(project({ lang: "fr" }), "/en/dev/alpha-app").inLanguage).toBe("fr");
  });

  it("publishes no local business until its details exist", () => {
    expect(site.repairBusiness).toBeNull();
    expect(localBusinessLd(null, "Réparation", "/fr/repair")).toBeNull();
  });

  it("is ready for the repair activity once it is registered", () => {
    const business = localBusinessLd(
      {
        name: "ELMZN Réparation",
        email: "contact@elmzn.be",
        street: "Rue de l'Exemple 1",
        postalCode: "1000",
        locality: "Bruxelles",
        country: "BE",
        areaServed: ["Bruxelles"],
        enterpriseNumber: "0123.456.789",
      },
      "Réparation de téléphones et de PC.",
      "/fr/repair",
    );
    expect(business).toMatchObject({
      "@type": "LocalBusiness",
      name: "ELMZN Réparation",
      url: "https://elmzn.be/fr/repair",
      address: { "@type": "PostalAddress", postalCode: "1000", addressLocality: "Bruxelles", addressCountry: "BE" },
      areaServed: ["Bruxelles"],
    });
    expect(business).not.toHaveProperty("telephone");
    expect(business).not.toHaveProperty("openingHours");
  });

  it("keeps a graph free of empty slots", () => {
    expect(graph(websiteLd(), null)).toEqual({ "@context": "https://schema.org", "@graph": [websiteLd()] });
  });

  it("can never close its own script tag, whatever the data holds", () => {
    const data = graph({ "@type": "Thing", name: "</script><script>alert(1)</script>" });
    const serialised = serializeJsonLd(data);
    expect(serialised).not.toContain("</script>");
    expect(serialised).not.toContain("<");
    expect(JSON.parse(serialised)).toEqual(data);
  });

  it("resolves paths against the real domain", () => {
    expect(absoluteUrl("/fr/dev")).toBe("https://elmzn.be/fr/dev");
  });
});

describe("sitemap and robots", () => {
  const entries = sitemapEntries(loadProjects(FIXTURES));
  const urls = entries.map((e) => e.url);

  it("lists every page in every language: desk, legal notice, chapters, published projects", () => {
    // 1 desk + 1 legal notice + 4 chapters + 4 published fixture projects, × 2 languages
    expect(entries).toHaveLength((1 + 1 + chapterIds.length + 4) * locales.length);
    expect(urls).toContain("https://elmzn.be/fr");
    expect(urls).toContain("https://elmzn.be/en/creative");
    expect(urls).toContain("https://elmzn.be/fr/creatif");
    expect(urls).toContain("https://elmzn.be/en/dev/alpha-app");
    expect(urls).toContain("https://elmzn.be/fr/mentions-legales");
    expect(urls).toContain("https://elmzn.be/en/legal-notice");
    expect(urls).not.toContain("https://elmzn.be/en/mentions-legales");
  });

  it("never lists a draft", () => {
    expect(urls.some((url) => url.includes("gamma-draft"))).toBe(false);
  });

  it("uses absolute URLs, each once", () => {
    for (const url of urls) expect(url).toMatch(/^https:\/\/elmzn\.be\//);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("gives every entry all its language versions, itself included", () => {
    for (const entry of entries) {
      const languages = entry.alternates!.languages as Record<string, string>;
      expect(Object.keys(languages).sort()).toEqual([...locales].sort());
      expect(Object.values(languages)).toContain(entry.url);
    }
  });

  it("opens the real site to crawlers, except the CMS, and points at the sitemap", () => {
    expect(robotsRules(true)).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/admin" },
      sitemap: "https://elmzn.be/sitemap.xml",
    });
  });

  it("closes previews entirely", () => {
    expect(robotsRules(false)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});

describe("manifest", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("installs on the desk, in the frame's colours, with every icon size", () => {
    const m = manifest();
    expect(m).toMatchObject({
      name: "ELMZN",
      short_name: "ELMZN",
      lang: "fr",
      start_url: "/fr",
      background_color: tokenColor("--color-ground"),
      theme_color: tokenColor("--color-ground"),
    });
    expect(m.icons?.map((i) => i.src)).toEqual(ICON_SIZES.map((size) => iconPath(size)));
    expect(m.icons?.map((i) => i.sizes)).toEqual(["32x32", "192x192", "512x512"]);
  });
});

describe("card layout rules", () => {
  it("keeps a centred square the width of the card's height", () => {
    expect(SAFE_SQUARE.width).toBe(630);
    expect(SAFE_SQUARE.left * 2 + SAFE_SQUARE.width).toBe(1200);
    expect(CONTENT_WIDTH).toBeLessThan(SAFE_SQUARE.width);
  });

  it("sizes titles between bounds, smaller as they get longer", () => {
    const sizes = ["Alpha", "Montage PC", "Vlog Malaisie", "iPhone 14 — caméra et flash", "x ".repeat(40)].map(titleSize);
    for (const size of sizes) {
      expect(size).toBeGreaterThanOrEqual(TITLE_MIN);
      expect(size).toBeLessThanOrEqual(TITLE_MAX);
    }
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]!);
  });

  it("shrinks a title until its longest word fits whole on one line — measured, not estimated", () => {
    const size = titleSize("Développement");
    expect(titleWidth("Développement", size)).toBeLessThanOrEqual(CONTENT_WIDTH);
    // …and no smaller than needed: two pixels more and it would not fit.
    expect(titleWidth("Développement", size + 2)).toBeGreaterThan(CONTENT_WIDTH - 8);
    expect(size).toBeLessThan(titleSize("Réparation"));
  });

  it("keeps a long title to three lines, at the largest size that allows it", () => {
    const long = "iPhone 16 Pro Max — remplacement de la vitre arrière et du châssis";
    const size = titleSize(long);
    expect(size).toBeGreaterThan(TITLE_MIN);
    expect(titleLines(long, size)).toBeLessThanOrEqual(3);
    expect(titleLines(long, size + 2) > 3 || titleWidth("remplacement", size + 2) > CONTENT_WIDTH - 8).toBe(true);
  });

  it("goes no smaller than the minimum: past three lines there, the card clamps the rest", () => {
    const tooLong =
      "Une animation de trajets de vol faite maison pour mes propres vidéos de voyage en Malaisie et ailleurs";
    expect(titleSize(tooLong)).toBe(TITLE_MIN);
  });

  it("keeps even a very long word whole when it fits at the minimum", () => {
    const word = "Anticonstitutionnellement";
    expect(titleWidth(word, titleSize(word))).toBeLessThanOrEqual(CONTENT_WIDTH);
  });

  it("falls back to the minimum only for a word too long to ever fit — the card then breaks it", () => {
    const word = "Anticonstitutionnellementdéraisonnablement";
    expect(titleSize(word)).toBe(TITLE_MIN);
    expect(titleWidth(word, TITLE_MIN)).toBeGreaterThan(CONTENT_WIDTH);
  });

  it("measures wider text as wider, and scales with size", () => {
    expect(titleWidth("WWWW", 60)).toBeGreaterThan(titleWidth("iiii", 60));
    expect(titleWidth("Alpha", 100)).toBeCloseTo(titleWidth("Alpha", 50) * 2, 5);
  });

  it("draws icon strokes at least 2px wide at every size", () => {
    for (const size of [32, 180, 192, 512]) {
      expect((iconStroke(size) * size * 0.72) / 64).toBeGreaterThanOrEqual(2 - 1e-9);
    }
  });
});

describe("the real content", () => {
  it("has no project or chapter title with a word too long to fit its card whole", () => {
    const titles = [
      ...loadProjects(join(ROOT, "content")).flatMap((p) => locales.map((l) => localizeProject(p, l).title)),
      ...locales.flatMap((l) => chapterIds.map((id) => getDictionary(l).chapters[id].name)),
    ];
    for (const title of titles) {
      const size = titleSize(title);
      for (const word of title.split(/\s+/)) {
        expect(titleWidth(word, size), `"${word}" in "${title}"`).toBeLessThanOrEqual(CONTENT_WIDTH);
      }
    }
  });
});
