import { expect, test } from "@playwright/test";

/**
 * Locale routing, checked at the HTTP level: status codes and Location
 * headers are what browsers and crawlers actually see.
 */
test.describe("locale routing", () => {
  const noFollow = { maxRedirects: 0 } as const;

  test("/ redirects to /fr with a temporary redirect", async ({ request }) => {
    const response = await request.get("/", noFollow);
    expect(response.status()).toBe(307);
    expect(new URL(response.headers()["location"]!, "http://x").pathname).toBe("/fr");
  });

  test("never guesses the language from the browser", async ({ request }) => {
    for (const language of ["en-GB,en;q=0.9", "nl-BE,nl;q=0.9", "de"]) {
      const response = await request.get("/", { ...noFollow, headers: { "accept-language": language } });
      expect(new URL(response.headers()["location"]!, "http://x").pathname, language).toBe("/fr");
    }
  });

  test("sends the infra chapter's former address, and its projects', to the homelab for good", async ({ request }) => {
    for (const [from, to] of [
      ["/fr/infra", "/fr/homelab"],
      ["/en/infra", "/en/homelab"],
      ["/fr/infra/homelab-fixture", "/fr/homelab/homelab-fixture"],
      ["/en/infra/homelab-fixture", "/en/homelab/homelab-fixture"],
    ]) {
      const response = await request.get(from!, noFollow);
      expect(response.status(), from).toBe(308);
      expect(new URL(response.headers()["location"]!, "http://x").pathname, from).toBe(to);
    }
    expect((await request.get("/fr/infra/homelab-fixture")).status()).toBe(200);
  });

  test("sends the homelab project's former address to /machines in one hop", async ({ request }) => {
    for (const [from, to] of [
      ["/fr/homelab/homelab", "/fr/homelab/machines"],
      ["/en/homelab/homelab", "/en/homelab/machines"],
      ["/fr/infra/homelab", "/fr/homelab/machines"],
    ]) {
      const response = await request.get(from!, noFollow);
      expect(response.status(), from).toBe(308);
      expect(new URL(response.headers()["location"]!, "http://x").pathname, from).toBe(to);
    }
  });

  test("prefixes paths without a locale and keeps the query string", async ({ request }) => {
    const response = await request.get("/dev/mytgc?ref=instagram", noFollow);
    expect(response.status()).toBe(307);
    const location = new URL(response.headers()["location"]!, "http://x");
    expect(location.pathname).toBe("/fr/dev/mytgc");
    expect(location.search).toBe("?ref=instagram");
  });

  test("lowercases a miscased locale", async ({ request }) => {
    const response = await request.get("/EN", noFollow);
    expect(new URL(response.headers()["location"]!, "http://x").pathname).toBe("/en");
  });

  test("serves both published locales directly, with the right lang", async ({ page }) => {
    for (const locale of ["fr", "en"]) {
      const response = await page.goto(`/${locale}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
    }
  });

  test("does not publish Dutch yet", async ({ request }) => {
    const response = await request.get("/nl");
    expect(response.status()).toBe(404);
  });

  test("leaves the CMS path alone", async ({ request }) => {
    const response = await request.get("/admin", noFollow);
    expect(response.status()).not.toBe(307);
  });
});

test.describe("404 without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("is complete in the HTML, not filled in by the client", async ({ page }) => {
    const response = await page.goto("/fr/removed");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ce dossier n'existe pas.");
    await expect(page.getByRole("navigation", { name: "Chapitres" }).getByRole("link")).toHaveCount(4);
  });
});

test.describe("404", () => {
  test("is a real 404, in the site's vocabulary, with the four folders", async ({ page }) => {
    const response = await page.goto("/fr/ce-dossier-nexiste-pas");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ce dossier n'existe pas.");
    const chapters = page.getByRole("navigation", { name: "Chapitres" });
    await expect(chapters.getByRole("link")).toHaveCount(4);
    await expect(page.getByRole("link", { name: "Retour au bureau", exact: true })).toHaveAttribute(
      "href",
      "/fr",
    );
  });

  test("speaks the language of the URL", async ({ page }) => {
    const response = await page.goto("/en/nothing/here");
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This folder doesn't exist.");
  });

  test("covers every kind of unknown URL, in the right language", async ({ request }) => {
    const cases: Array<[string, string]> = [
      ["/fr/nope", "fr"], // unknown single segment
      ["/fr/a/b/c", "fr"], // unknown deep path
      ["/en/creatif", "en"], // a chapter slug from the other language
      ["/en/dev/removed-project", "en"], // a project that no longer exists
    ];
    for (const [path, lang] of cases) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
      const html = await response.text();
      expect(html, path).toContain(`<html lang="${lang}"`);
      expect(html, path).toMatch(/<h1[^>]*>(Ce dossier n|This folder doesn)/);
    }
  });

  test("never asks the server for missing pages in the background, and switches language by a full load", async ({
    page,
  }) => {
    const rsc: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("_rsc=")) rsc.push(new URL(r.url()).pathname);
    });
    await page.goto("/fr/nope");
    await expect(page.getByRole("banner").locator("time")).toBeVisible(); // hydrated
    await page.waitForTimeout(800);
    expect(rsc).toEqual([]);

    await page.getByRole("navigation", { name: "Langue" }).getByRole("link", { name: /EN/ }).click();
    await expect(page).toHaveURL(/\/en\/nope$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This folder doesn't exist.");
    expect(rsc).toEqual([]);
  });

  test("catches unlocalized dead links too", async ({ page }) => {
    const response = await page.goto("/old-page");
    expect(page.url()).toMatch(/\/fr\/old-page$/);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ce dossier n'existe pas.");
  });
});
