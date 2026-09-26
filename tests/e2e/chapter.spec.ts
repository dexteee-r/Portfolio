import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { horizontalOverflow } from "./helpers";

/** Fixture content: dev = alpha (cover) + beta (no cover, FR only) + a hidden draft. */
test.describe("chapter page, loaded directly", () => {
  test("stands on its own: title, description, real count, stations", async ({ page }) => {
    const response = await page.goto("/fr/dev");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("Développement — ELMZN");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Développement");
    await expect(page.getByText("2 projets")).toBeVisible();

    const stations = page.getByRole("list", { name: "Projets" }).getByRole("listitem");
    await expect(stations).toHaveCount(2);
    await expect(stations.nth(0).getByRole("link", { name: "Alpha" })).toHaveAttribute("href", "/fr/dev/alpha-app");
    await expect(stations.nth(1).getByRole("link", { name: "Bêta" })).toHaveAttribute("href", "/fr/dev/beta-tool");
  });

  test("never shows drafts in production", async ({ page }) => {
    await page.goto("/fr/dev");
    await expect(page.getByText("Gamma brouillon")).toHaveCount(0);
  });

  test("paints the whole document in the chapter's ground — no light frame behind", async ({ page }) => {
    await page.goto("/fr/dev");
    // No transition may carry the ground from the light frame: it would fade in from light.
    for (const selector of ["html", "body"]) {
      const transition = await page.locator(selector).evaluate((el) => {
        const style = getComputedStyle(el);
        return { property: style.transitionProperty, duration: style.transitionDuration };
      });
      const fadesGround =
        /all|background/.test(transition.property) && transition.duration.split(",").some((d) => parseFloat(d) > 0);
      expect(fadesGround, `${selector}: ${JSON.stringify(transition)}`).toBe(false);
    }
    const ground = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    expect(ground).toBe("rgb(13, 15, 31)"); // --dev-bg
    await expect(page.locator('[data-view="chapter"]')).toHaveAttribute("data-chapter", "dev");
  });

  test("serves its cover through the image pipeline, described", async ({ page }) => {
    await page.goto("/fr/dev");
    const cover = page.getByRole("img", { name: "Dégradé indigo, image de test." });
    await expect(cover).toBeVisible();
    expect(await cover.getAttribute("src")).toContain("/_next/image");
    await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  });

  test("marks a French fallback on the English page", async ({ page }) => {
    await page.goto("/en/dev");
    const beta = page.locator('[data-station="beta-tool"]');
    await expect(beta).toHaveAttribute("lang", "fr");
    await expect(page.locator('[data-station="alpha-app"]')).not.toHaveAttribute("lang", /.+/);
  });

  test("says plainly when it is empty", async ({ page }) => {
    await page.goto("/fr/repair");
    await expect(page.getByText("Ce dossier est encore vide.")).toBeVisible();
    await expect(page.getByText("0 projet")).toBeVisible();
  });

  test("uses translated slugs, and the wrong language's slug is a 404", async ({ page, request }) => {
    expect((await page.goto("/en/creative"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Creative");
    expect((await request.get("/en/creatif")).status()).toBe(404);
    expect((await request.get("/fr/creative")).status()).toBe(404);
  });

  test("declares its other language versions", async ({ page }) => {
    await page.goto("/fr/creatif");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://elmzn.be/fr/creatif");
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute("href", "https://elmzn.be/en/creative");
    await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute("href", "https://elmzn.be/fr/creatif");
  });

  test("switches language to the same chapter", async ({ page }) => {
    await page.goto("/fr/creatif");
    await page.getByRole("navigation", { name: "Langue" }).getByRole("link", { name: /EN/ }).click();
    await expect(page).toHaveURL(/\/en\/creative$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Creative");
  });

  test("shows where you are and how to get back", async ({ page }) => {
    await page.goto("/fr/dev");
    const trail = page.getByRole("navigation", { name: "Fil d'Ariane" });
    await expect(trail.getByRole("link", { name: "ELMZN — retour au bureau" })).toHaveAttribute("href", "/fr");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Retour au bureau" })).toHaveAttribute(
      "href",
      "/fr",
    );
  });

  test("never scrolls sideways, and clips nothing", async ({ page }) => {
    await page.goto("/fr/dev");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    expect(await horizontalOverflow(page)).toEqual([]);
  });
});

test.describe("every chapter on the smallest phones (320px)", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of ["/fr/dev", "/fr/infra", "/fr/repair", "/fr/creatif", "/en/dev", "/en/infra", "/en/repair", "/en/creative"]) {
    test(`${path}: the whole title fits, nothing sticks out`, async ({ page }) => {
      await page.goto(path);
      expect(await horizontalOverflow(page)).toEqual([]);
    });
  }
});

test.describe("chapter page without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("is complete in the HTML — the repair text reads before any script", async ({ page }) => {
    await page.goto("/fr/repair");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Réparation");
    await expect(page.getByText("Réparation de téléphones et de PC", { exact: false })).toBeVisible();
  });

  test("links from the desk still work", async ({ page }) => {
    await page.goto("/fr");
    await page.locator('[data-chapter-mark="dev"]').click();
    await expect(page).toHaveURL(/\/fr\/dev$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Développement");
  });
});

test.describe("accessibility of every grade (axe, WCAG 2.1 AA)", () => {
  for (const path of ["/fr/dev", "/fr/infra", "/fr/repair", "/fr/creatif", "/en/dev", "/en/creative"]) {
    test(`${path} has no violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    });
  }
});
