import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow } from "./helpers";

/** Fixture content: dev = alpha (cover, links, rich text) → beta (FR only, no text). */

async function hydrated(page: Page) {
  await expect(page.getByRole("banner").locator("time")).toBeVisible();
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await hydrated(page);
}

const liveView = (page: Page) => page.locator("[data-stage-views] [data-view]");

test.describe("project page, loaded directly", () => {
  test("reads in full: chapter, year, title, summary, links, cover, text", async ({ page }) => {
    const response = await page.goto("/fr/dev/alpha-app");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("Alpha — ELMZN");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Une application de test, entièrement traduite.",
    );

    await expect(page.getByText("Développement · 2025")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alpha");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    const links = page.getByRole("list", { name: "Liens du projet" });
    await expect(links.getByRole("link", { name: /Voir le site/ })).toHaveAttribute("href", "https://example.com/alpha");
    await expect(links.getByRole("link", { name: /Code source/ })).toHaveAttribute(
      "href",
      "https://github.com/example/alpha",
    );

    const cover = page.getByRole("img", { name: "Dégradé indigo, image de test." });
    await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    await expect(page.getByRole("heading", { level: 2, name: "Contexte" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Choix techniques" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Titre écrit en niveau 1" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.locator(".prose pre code")).toContainText("const answer = 42;");
    await expect(page.locator(".prose").getByRole("link", { name: "lien vers le chapitre" })).toHaveAttribute(
      "href",
      "/fr/dev",
    );
  });

  test("shows text images at their own proportions, captioned", async ({ page }) => {
    await page.goto("/fr/dev/alpha-app");
    const figure = page.locator(".prose figure");
    await expect(figure.locator("figcaption")).toHaveText("Légende de la capture");
    const shot = figure.getByRole("img", { name: "Capture de test au format 4:3" });
    await shot.scrollIntoViewIfNeeded();
    await expect.poll(() => shot.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    const box = (await shot.boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(4 / 3, 1);
    expect(await shot.getAttribute("src")).toContain("/_next/image");
  });

  test("declares its other language version", async ({ page }) => {
    await page.goto("/fr/dev/alpha-app");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://elmzn.be/fr/dev/alpha-app");
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute("href", "https://elmzn.be/en/dev/alpha-app");
    await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute(
      "href",
      "https://elmzn.be/fr/dev/alpha-app",
    );
  });

  test("an untranslated project reads in French on the English page, and says so", async ({ page }) => {
    await page.goto("/en/dev/beta-tool");
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toHaveText("Bêta");
    await expect(title.locator("xpath=ancestor::*[@lang][1]")).toHaveAttribute("lang", "fr");
    await expect(page.locator(".prose")).toHaveCount(0);
  });

  test("links to its neighbours in the chapter", async ({ page }) => {
    await page.goto("/fr/dev/alpha-app");
    const siblings = page.getByRole("navigation", { name: "Autres projets du chapitre" });
    await expect(siblings.getByRole("link")).toHaveCount(1);
    await expect(siblings.getByRole("link", { name: /Projet suivant/ })).toHaveAttribute("href", "/fr/dev/beta-tool");

    await page.goto("/fr/dev/beta-tool");
    await expect(
      page.getByRole("navigation", { name: "Autres projets du chapitre" }).getByRole("link", { name: /Projet précédent/ }),
    ).toHaveAttribute("href", "/fr/dev/alpha-app");
  });

  test("drafts, wrong chapters and wrong-language slugs are 404s", async ({ request }) => {
    for (const path of ["/fr/dev/gamma-draft", "/fr/infra/alpha-app", "/en/creatif/film-test", "/fr/dev/nope"]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
    expect((await request.get("/en/creative/film-test")).status()).toBe(200);
  });

  test("the station links of a chapter all lead somewhere", async ({ page, request }) => {
    await page.goto("/fr/dev");
    const hrefs = await page.locator("[data-station] h2 a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect((await request.get(href!)).status(), href!).toBe(200);
  });
});

test.describe("project page without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("is complete in the HTML", async ({ page }) => {
    await page.goto("/fr/dev/alpha-app");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alpha");
    await expect(page.getByRole("heading", { level: 2, name: "Contexte" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.locator("[data-floppy]")).toBeVisible();
    await expect(page.getByRole("region", { name: "Fiche technique" })).toBeVisible();
  });
});

test.describe("the dev chapter's floppy disk", () => {
  const shutter = (page: Page) => page.locator("[data-floppy] .floppy-shutter");
  const transform = (page: Page) => shutter(page).evaluate((el) => getComputedStyle(el).transform);
  /** At rest, the shutter is open: slid 14 units to the right. */
  const OPEN = "matrix(1, 0, 0, 1, 14, 0)";

  test("heads a dev project: the disk, labelled, then its spec sheet", async ({ page }) => {
    await page.goto("/fr/dev/alpha-app");
    const floppy = page.locator("[data-floppy]");
    await expect(floppy).toBeVisible();
    await expect(floppy).toHaveAttribute("aria-hidden", "true");
    await expect(floppy.locator("[data-floppy-disk]")).toHaveText("01/02");

    const sheet = page.getByRole("region", { name: "Fiche technique" });
    await expect(sheet.getByRole("term")).toHaveText(["Année", "Rôle", "Stack"]);
    await expect(sheet.getByRole("definition").first()).toHaveText("2025");
    await expect(sheet.getByRole("definition").nth(1)).toHaveText("Conception et développement");
    await expect(sheet.getByRole("listitem")).toHaveText(["Next.js", "PostgreSQL", "Docker"]);
  });

  test("sits under the title: beside its sheet on a phone, on the right on a wide screen", async ({ page }) => {
    await page.goto("/fr/dev/alpha-app");
    const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    const disk = (await page.locator("[data-floppy]").boundingBox())!;
    const sheet = (await page.locator("[data-specs]").boundingBox())!;
    expect(sheet.y).toBeGreaterThan(title.y + title.height);
    if (page.viewportSize()!.width >= 1024) {
      expect(disk.x).toBeGreaterThan(sheet.x + sheet.width);
      expect(disk.y).toBeLessThan(sheet.y);
    } else {
      expect(disk.y).toBeGreaterThan(title.y + title.height);
      expect(Math.abs(disk.y - sheet.y)).toBeLessThan(2);
      expect(disk.x + disk.width).toBeLessThan(sheet.x);
    }
  });

  test("slides its shutter open once — from closed — then rests open", async ({ page }) => {
    await page.goto("/fr/dev/alpha-app");
    await shutter(page).evaluate((el) =>
      el.getAnimations().forEach((a) => {
        a.pause();
        a.currentTime = 0;
      }),
    );
    expect(await transform(page)).toBe("matrix(1, 0, 0, 1, 0, 0)"); // closed while the page fades in
    await shutter(page).evaluate((el) => el.getAnimations().forEach((a) => a.play()));
    await expect.poll(() => transform(page)).toBe(OPEN);
    await expect
      .poll(() => shutter(page).evaluate((el) => el.getAnimations().every((a) => a.playState === "finished")))
      .toBe(true);
  });

  test("reduced motion: the disk is simply open", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/fr/dev/alpha-app");
    expect(await shutter(page).evaluate((el) => el.getAnimations().length)).toBe(0);
    expect(await transform(page)).toBe(OPEN);
  });

  test("the English page names the sheet in English, and marks the French role", async ({ page }) => {
    await page.goto("/en/dev/beta-tool");
    await expect(page.locator("[data-floppy-disk]")).toHaveText("02/02");
    const sheet = page.getByRole("region", { name: "Spec sheet" });
    await expect(sheet.getByRole("term")).toHaveText(["Role"]);
    await expect(sheet.getByText("Outil interne, en solo")).toHaveAttribute("lang", "fr");
  });

  test("is the dev chapter's object only", async ({ page }) => {
    for (const path of ["/fr/creatif/film-test", "/fr/infra/homelab-fixture"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("[data-floppy]"), path).toHaveCount(0);
      await expect(page.locator("[data-specs]"), path).toHaveCount(0);
    }
  });
});

test.describe("project pages on the smallest phones (320px)", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of ["/fr/dev/alpha-app", "/en/dev/beta-tool", "/fr/creatif/film-test"]) {
    test(`${path}: nothing sticks out — tables and code scroll in their own frame`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
      expect(await horizontalOverflow(page)).toEqual([]);
    });
  }
});

test.describe("accessibility of project pages (axe, WCAG 2.1 AA)", () => {
  for (const path of ["/fr/dev/alpha-app", "/en/dev/alpha-app", "/en/dev/beta-tool", "/fr/creatif/film-test", "/fr/infra/homelab-fixture"]) {
    test(`${path} has no violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    });
  }
});

test.describe("moving between a chapter and its projects", () => {
  test("station → project: a quiet fade, never the drawer, focus on the title", async ({ page }) => {
    await open(page, "/fr/dev");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Animation.enable");
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.1 });

    await page.locator('[data-station="alpha-app"] h2 a').click();
    await expect(page).toHaveURL(/\/fr\/dev\/alpha-app$/);
    await expect(liveView(page)).toHaveAttribute("data-view", "project");

    const fading = await liveView(page).evaluate((el) =>
      el.getAnimations().flatMap((a) => (a.effect as KeyframeEffect).getKeyframes().map((k) => Object.keys(k))).flat(),
    );
    expect(fading).toContain("opacity");
    await expect(page.locator("[data-stage-leaving]")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  });

  test("Escape closes a project onto its chapter, with the station of origin in view and focused", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "keyboard");
    await page.setViewportSize({ width: 1280, height: 600 });
    await open(page, "/fr/dev");
    await page.locator('[data-station="beta-tool"] h2 a').click();
    await expect(page).toHaveURL(/\/fr\/dev\/beta-tool$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/fr\/dev$/);
    const link = page.locator('[data-station="beta-tool"] h2 a');
    await expect(link).toBeFocused();
    await expect(link).toBeInViewport();
    await expect(page.locator("[data-stage-leaving]")).toHaveCount(0);
  });

  test("the back link does the same", async ({ page }) => {
    await open(page, "/fr/dev/beta-tool");
    await page.getByRole("contentinfo").getByRole("link", { name: "Retour au chapitre" }).click();
    await expect(page).toHaveURL(/\/fr\/dev$/);
    await expect(page.locator('[data-station="beta-tool"] h2 a')).toBeInViewport();
  });

  test("a second Escape then closes the chapter onto the desk, with the drawer", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard");
    await open(page, "/fr/dev/alpha-app");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/fr\/dev$/);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.locator('[data-chapter-mark="dev"]')).toBeFocused();
  });

  test("the logo on a project goes back to the desk with the drawer", async ({ page }) => {
    await open(page, "/fr/creatif/film-test");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Animation.enable");
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.1 });
    await page.getByRole("link", { name: "ELMZN — retour au bureau" }).click();
    await expect(page.locator("[data-stage-leaving]")).toHaveCount(1);
    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.locator("[data-stage-leaving]")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('[data-chapter-mark="creative"]')).toBeFocused();
  });

  test("reduced motion: the project simply appears", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "/fr/dev");
    await page.locator('[data-station="alpha-app"] h2 a').click();
    await expect(page).toHaveURL(/\/fr\/dev\/alpha-app$/);
    expect(await liveView(page).evaluate((el) => el.getAnimations().length)).toBe(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  });

  test("the browser's back button returns to the chapter cleanly", async ({ page }) => {
    await open(page, "/fr/dev");
    await page.locator('[data-station="alpha-app"] h2 a').click();
    await expect(page).toHaveURL(/\/fr\/dev\/alpha-app$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/fr\/dev$/);
    await expect(liveView(page)).toHaveAttribute("data-view", "chapter");
    await expect(liveView(page)).toHaveCSS("opacity", "1");
  });
});
