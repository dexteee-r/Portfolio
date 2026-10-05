import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow } from "./helpers";

/** Fixture content: dev 2 published + 1 draft, infra 1, repair 1, creative 1. */
const FR_MARKS = [
  { name: "Développement 2 projets", href: "/fr/dev" },
  { name: "Homelab 1 projet", href: "/fr/homelab" },
  { name: "Réparation/Montage 1 projet", href: "/fr/repair" },
  { name: "Création 1 projet", href: "/fr/creatif" },
];

async function marks(page: Page) {
  return page.getByRole("navigation", { name: /Chapitres|Chapters/ }).getByRole("link");
}

test.describe("desk", () => {
  test("shows the name and the activity on first paint", async ({ page }) => {
    await page.goto("/fr");
    const name = page.getByRole("heading", { level: 1 });
    const identity = page.getByText(
      "Bricoleur du numérique en Belgique : des applis et des sites, un homelab, des PC montés et réparés, des téléphones remis en état. Et je filme aussi.",
    );
    await expect(name).toBeInViewport();
    await expect(identity).toBeInViewport();
  });

  test("lists the four chapters with their real, published-only counts", async ({ page }) => {
    await page.goto("/fr");
    const links = await marks(page);
    await expect(links).toHaveCount(4);
    for (const [index, mark] of FR_MARKS.entries()) {
      await expect(links.nth(index)).toHaveAccessibleName(mark.name);
      await expect(links.nth(index)).toHaveAttribute("href", mark.href);
    }
  });

  test("keeps all four folders in the first screen", async ({ page }) => {
    await page.goto("/fr");
    const links = await marks(page);
    for (let i = 0; i < 4; i++) await expect(links.nth(i)).toBeInViewport();
  });

  test("never scrolls sideways, and clips nothing — desk and 404, down to 320px", async ({ page }) => {
    for (const width of [page.viewportSize()!.width, 320]) {
      await page.setViewportSize({ width, height: 700 });
      for (const path of ["/fr", "/en", "/fr/missing", "/en/missing"]) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} @${width}`).toBe(0);
        expect(await horizontalOverflow(page), `${path} @${width}`).toEqual([]);
      }
    }
  });

  test("on the smallest phones (320px), each folder's name stays in its own column", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    for (const path of ["/fr", "/en"]) {
      await page.goto(path);
      const boxes = await page.locator("[data-chapter-mark]").evaluateAll((links) =>
        links.map((link) => {
          const name = link.querySelector("span > span")!.getBoundingClientRect();
          const own = link.getBoundingClientRect();
          return { name: link.textContent, left: name.left, right: name.right, top: name.top, bottom: name.bottom, ownRight: own.right };
        }),
      );
      for (const box of boxes) expect(box.right, `${path} ${box.name}`).toBeLessThanOrEqual(box.ownRight + 0.5);
      for (const a of boxes) {
        for (const b of boxes) {
          if (a === b) continue;
          const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          expect(overlap, `${path}: ${a.name} / ${b.name}`).toBe(false);
        }
      }
    }
  });

  test("declares every language version to search engines", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://elmzn.be/en");
    const alternates = page.locator('link[rel="alternate"][hreflang]');
    await expect(alternates).toHaveCount(3);
    await expect(page.locator('link[hreflang="fr"]')).toHaveAttribute("href", "https://elmzn.be/fr");
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute("href", "https://elmzn.be/en");
    await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute("href", "https://elmzn.be/fr");
  });

  test("switches language from the visible selector, and only from there", async ({ page }) => {
    await page.goto("/fr");
    await page.getByRole("navigation", { name: "Langue" }).getByRole("link", { name: /EN/ }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText("Digital tinkerer based in Belgium: apps and websites, a homelab", { exact: false })).toBeVisible();
    const links = await marks(page);
    await expect(links.nth(3)).toHaveAttribute("href", "/en/creative");
    await expect(links.nth(2)).toHaveAccessibleName("Repair/Build 1 project");
  });

  test("shows the local time once hydrated", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.getByRole("banner").locator("time")).toHaveText(/^\d{2}:\d{2}$/);
  });

  test("lets keyboard users skip straight to the content", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard navigation is a desktop concern");
    await page.goto("/fr");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Aller au contenu" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#content$/);
  });

  test("shows a visible focus ring on the folders", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard navigation is a desktop concern");
    await page.goto("/fr");
    const first = (await marks(page)).first();
    await first.focus();
    const outline = await first.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
  });
});

test.describe("the desk's koi", () => {
  test("swim on the right of the desk, on a wide screen, decorative", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "wide screens with a mouse only");
    await page.goto("/fr");
    const art = page.locator("[data-desk-art]");
    await expect(art).toBeVisible();
    await expect(art).toHaveAttribute("data-desk-art", "koi");
    await expect(art).toHaveAttribute("aria-hidden", "true");
    // They are drawn — ink on the canvas — and they swim.
    const inked = () =>
      art.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
        const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
        let ink = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i]) ink += 1;
        return ink;
      });
    const first = await inked();
    expect(first).toBeGreaterThan(1000);
    await expect.poll(inked, { timeout: 5000 }).not.toBe(first);
    // Right of the name, never over it.
    const name = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    const koi = (await art.boundingBox())!;
    expect(koi.x).toBeGreaterThan(name.x + name.width);
  });

  test("is not even loaded on a phone", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "a phone");
    await page.goto("/fr");
    await expect(page.getByRole("banner").locator("time")).toBeVisible();
    await expect(page.locator("[data-desk-art]")).toHaveCount(0);
  });
});

test.describe("desk without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("is complete: name, activity and the four links are in the HTML", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("des PC montés et réparés", { exact: false })).toBeVisible();
    await expect(await marks(page)).toHaveCount(4);
  });
});

test.describe("accessibility (axe, WCAG 2.1 AA)", () => {
  for (const path of ["/fr", "/en", "/fr/nope"]) {
    test(`${path} has no violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }
});
