import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow, settled } from "./helpers";

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

  test("opens on the drawer: one tabbed folder per project, above the stations", async ({ page }) => {
    await page.goto("/fr/dev");
    const drawer = page.getByRole("navigation", { name: "Sommaire du dossier" });
    const folders = drawer.getByRole("link");
    await expect(folders).toHaveCount(2);
    await expect(folders.nth(0)).toHaveAttribute("href", "/fr/dev/alpha-app");
    await expect(folders.nth(1)).toHaveAttribute("href", "/fr/dev/beta-tool");
    await expect(drawer.getByText("01", { exact: true })).toBeVisible();
    // The drawer's contents come before the stroll through them.
    const drawerTop = (await drawer.boundingBox())!.y;
    const stationsTop = (await page.getByRole("list", { name: "Projets" }).boundingBox())!.y;
    expect(drawerTop).toBeLessThan(stationsTop);
  });

  test("a chapter with a single project has no drawer: its station says it all", async ({ page }) => {
    await page.goto("/fr/creatif");
    await expect(page.getByRole("navigation", { name: "Sommaire du dossier" })).toHaveCount(0);
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

test.describe("the drawer, open", () => {
  const folder = (page: Page, n: number) => page.locator("[data-folder]").nth(n);
  const width = async (page: Page, n: number) => (await folder(page, n).boundingBox())!.width;

  test("on a wide screen, a folder widens under the pointer, the others make room", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "hover needs a pointer");
    await page.goto("/fr/dev");
    const [first, second] = [await width(page, 0), await width(page, 1)];
    expect(Math.abs(first - second)).toBeLessThan(2); // equal at rest

    await folder(page, 1).hover();
    await expect.poll(() => width(page, 1)).toBeGreaterThan(second * 1.3);
    expect(await width(page, 0)).toBeLessThan(first);
  });

  test("the keyboard gets the same: a focused folder widens too", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "a wide-screen layout");
    await page.goto("/fr/dev");
    const rest = await width(page, 0);
    await folder(page, 0).getByRole("link").focus();
    await expect.poll(() => width(page, 0)).toBeGreaterThan(rest * 1.3);
  });

  test("taking a folder out opens its project, quietly, inside the chapter", async ({ page }) => {
    await page.goto("/fr/dev");
    await expect(page.getByRole("banner").locator("time")).toBeVisible();
    await folder(page, 0).getByRole("link").click();
    await expect(page).toHaveURL(/\/fr\/dev\/alpha-app$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alpha");
    await expect(page.locator("[data-stage-leaving]")).toHaveCount(0);
  });

  test("on a phone, the drawer scrolls sideways, edge to edge, folders snapping to the margin", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "a phone layout");
    await page.goto("/fr/dev");
    const list = page.getByRole("navigation", { name: "Sommaire du dossier" }).getByRole("list");
    const style = await list.evaluate((el) => {
      const s = getComputedStyle(el);
      return { overflowX: s.overflowX, snap: s.scrollSnapType, padding: s.scrollPaddingLeft };
    });
    expect(style.overflowX).toBe("auto");
    expect(style.snap).toContain("x");
    expect(parseFloat(style.padding)).toBeGreaterThan(0);
    const box = (await list.boundingBox())!;
    expect(box.x).toBe(0); // edge to edge
    expect((await folder(page, 0).boundingBox())!.x).toBeGreaterThan(0); // the first folder keeps the page's margin
  });
});

test.describe("the infra chapter's network map", () => {
  test("draws the homelab under the title: every machine named, then traced once seen", async ({ page }) => {
    await page.goto("/fr/infra");
    const map = page.locator("[data-network]");
    await expect(map.getByText("Le homelab, tel qu'il tourne")).toBeVisible();
    const drawing = map.locator("svg:visible");
    await expect(drawing).toHaveCount(1); // the tree on a wide screen, the list on a phone
    // "Internet" is both a name and a kind: the names that are only names.
    for (const label of ["host-fixture", "site-fixture", "app-fixture"]) {
      await expect(drawing.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(map).toHaveAttribute("data-drawn", "");
    await expect
      .poll(() => drawing.locator(".net-line").last().evaluate((line) => getComputedStyle(line).strokeDashoffset))
      .toBe("0px");
  });

  test("never appears in another chapter", async ({ page }) => {
    await page.goto("/fr/dev");
    await expect(page.locator("[data-network]")).toHaveCount(0);
  });

  test("speaks the page's language", async ({ page }) => {
    await page.goto("/en/infra");
    await expect(page.getByText("The homelab, as it runs")).toBeVisible();
    await expect(page.locator("[data-network] svg:visible").getByText("Hypervisor").first()).toBeVisible();
  });
});

test.describe("the network map without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("is simply there, drawn", async ({ page }) => {
    await page.goto("/fr/infra");
    const map = page.locator("[data-network]");
    await expect(map).not.toHaveAttribute("data-armed", "");
    await expect(map.locator("svg:visible").getByText("host-fixture", { exact: true })).toBeVisible();
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
      // Read the page as it stays, not a frame caught mid-animation.
      await settled(page);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    });
  }
});
