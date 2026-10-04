import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import sharp from "sharp";

/** Fixture content: dev = alpha + beta, infra = homelab, creative = film; one draft (gamma). */

const meta = (page: Page, key: string) =>
  page.locator(`meta[property="${key}"], meta[name="${key}"]`).first().getAttribute("content");

/** An absolute URL on the real domain, fetched from the test server instead. */
const local = (url: string) => new URL(url).pathname + new URL(url).search;

async function png(request: APIRequestContext, url: string) {
  const response = await request.get(local(url));
  expect(response.status(), url).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  return Buffer.from(await response.body());
}

/** Columns of a card holding anything but its top-left ground colour. */
async function inkedSpan(buffer: Buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => [0, 1, 2].map((c) => data[(y * info.width + x) * 3 + c]!);
  const ground = at(0, 0);
  let left = info.width;
  let right = -1;
  for (let x = 0; x < info.width; x++) {
    for (let y = 0; y < info.height; y += 2) {
      if (at(x, y).some((v, i) => Math.abs(v - ground[i]!) > 1)) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        break;
      }
    }
  }
  return { width: info.width, height: info.height, left, right };
}

async function jsonLd(page: Page) {
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  return JSON.parse(raw!) as { "@graph": Array<Record<string, unknown>> };
}

test.describe("for crawlers", () => {
  test("robots.txt opens the site, closes the CMS and points at the sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain("Allow: /");
    expect(text).toContain("Disallow: /admin");
    expect(text).toContain("Sitemap: https://elmzn.be/sitemap.xml");
  });

  test("the sitemap lists every published page in both languages, with hreflang", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");
    const xml = await response.text();
    for (const path of [
      "/fr",
      "/en",
      "/fr/mentions-legales",
      "/en/legal-notice",
      "/fr/creatif",
      "/en/creative",
      "/fr/dev/alpha-app",
      "/en/homelab/homelab-fixture",
    ]) {
      expect(xml).toContain(`<loc>https://elmzn.be${path}</loc>`);
    }
    expect(xml).toContain('hreflang="en" href="https://elmzn.be/en/dev/alpha-app"');
    expect(xml).not.toContain("gamma-draft");
    // (desk + legal notice + 4 chapters + 5 published fixture projects) × 2 languages
    expect(xml.match(/<url>/g)).toHaveLength(22);
  });

  test("every listed URL answers 200", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    for (const url of urls) expect((await request.get(local(url))).status(), url).toBe(200);
  });

  test("pages are indexable; the 404 is not", async ({ page }) => {
    await page.goto("/fr/dev");
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await page.goto("/fr/nothing-here");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});

test.describe("structured data", () => {
  test("the desk introduces the site and its owner", async ({ page }) => {
    await page.goto("/fr");
    const types = (await jsonLd(page))["@graph"].map((item) => item["@type"]);
    expect(types).toEqual(["WebSite", "Person"]);
  });

  test("a project page gives its breadcrumb and describes the project", async ({ page }) => {
    await page.goto("/en/dev/alpha-app");
    const [crumbs, project] = (await jsonLd(page))["@graph"];
    expect((crumbs!.itemListElement as unknown[]).length).toBe(3);
    expect(project).toMatchObject({ "@type": "CreativeWork", name: "Alpha", url: "https://elmzn.be/en/dev/alpha-app" });
  });

  test("the repair chapter keeps its local-business slot empty until it is filled", async ({ page }) => {
    await page.goto("/fr/repair");
    const types = (await jsonLd(page))["@graph"].map((item) => item["@type"]);
    expect(types).toEqual(["BreadcrumbList"]);
  });
});

test.describe("link previews", () => {
  const pages = [
    { path: "/fr", title: "ELMZN — développement, homelab, réparation et montage, création", locale: "fr_BE", type: "website" },
    { path: "/en", title: "ELMZN — development, homelab, repair and builds, film", locale: "en_GB", type: "website" },
    { path: "/fr/dev", title: "Développement — ELMZN", locale: "fr_BE", type: "website" },
    { path: "/fr/repair", title: "Réparation/Montage — ELMZN", locale: "fr_BE", type: "website" },
    { path: "/en/creative/film-test", title: "Test film — ELMZN", locale: "en_GB", type: "article" },
    { path: "/fr/dev/alpha-app", title: "Alpha — ELMZN", locale: "fr_BE", type: "article" },
    { path: "/fr/mentions-legales", title: "Mentions légales — ELMZN", locale: "fr_BE", type: "website" },
    { path: "/en/legal-notice", title: "Legal notice — ELMZN", locale: "en_GB", type: "website" },
  ];

  for (const expected of pages) {
    test(`${expected.path}: complete Open Graph and Twitter tags, and a card that respects the brief`, async ({
      page,
      request,
    }) => {
      await page.goto(expected.path);
      expect(await meta(page, "og:title")).toBe(expected.title);
      expect(await meta(page, "og:url")).toBe(`https://elmzn.be${expected.path}`);
      expect(await meta(page, "og:locale")).toBe(expected.locale);
      expect(await meta(page, "og:type")).toBe(expected.type);
      expect(await meta(page, "og:site_name")).toBe("ELMZN");
      expect(await meta(page, "og:description")).toBeTruthy();
      expect(await meta(page, "og:image:alt")).toBeTruthy();
      expect(await meta(page, "twitter:card")).toBe("summary_large_image");

      const image = (await meta(page, "og:image"))!;
      expect(image).toMatch(/^https:\/\/elmzn\.be\//);
      const card = await inkedSpan(await png(request, image));
      expect([card.width, card.height]).toEqual([1200, 630]);
      // Everything that matters inside the centred square: messaging apps crop to it.
      expect(card.left).toBeGreaterThanOrEqual(285);
      expect(card.right).toBeLessThan(915);
    });
  }

  test("each language has its own card", async ({ page }) => {
    await page.goto("/fr/dev");
    const fr = await meta(page, "og:image");
    await page.goto("/en/dev");
    const en = await meta(page, "og:image");
    expect(fr).not.toBe(en);
    expect(await meta(page, "og:image:alt")).toBe("Development — ELMZN");
  });
});

test.describe("icons, manifest and browser colour", () => {
  test("every page links the favicon, the home-screen icon and the manifest", async ({ page, request }) => {
    for (const path of ["/fr", "/fr/dev", "/fr/dev/alpha-app"]) {
      await page.goto(path);
      const icons = await page.locator('link[rel="icon"]').evaluateAll((links) =>
        links.map((l) => [l.getAttribute("href"), l.getAttribute("sizes")]),
      );
      expect(icons.map(([, sizes]) => sizes)).toEqual(["32x32", "192x192", "512x512"]);
      await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("sizes", "180x180");
      await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
      for (const [href, sizes] of icons) {
        const buffer = await png(request, `https://elmzn.be${href}`);
        const { width, height } = await sharp(buffer).metadata();
        expect(`${width}x${height}`).toBe(sizes);
      }
    }
  });

  test("the manifest opens the desk and its icons all exist", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.start_url).toBe("/fr");
    for (const icon of manifest.icons as Array<{ src: string; sizes: string }>) {
      const { width, height } = await sharp(await png(request, `https://elmzn.be${icon.src}`)).metadata();
      expect(`${width}x${height}`).toBe(icon.sizes);
    }
  });

  test("the browser's chrome takes the colour of the page's ground", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f6f6f4");
    await page.goto("/fr/dev");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0d0f1f");
    await page.goto("/fr/repair");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#14100e");
    await page.goto("/en/creative/film-test");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0c0b08");
  });
});
