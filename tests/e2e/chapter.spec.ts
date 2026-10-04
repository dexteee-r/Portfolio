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

  test("lets go of the blurred preview once the cover has loaded", async ({ page }) => {
    await page.goto("/fr/dev");
    const cover = page.getByRole("img", { name: "Dégradé indigo, image de test." });
    await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect.poll(() => cover.evaluate((img) => getComputedStyle(img).backgroundImage)).toBe("none");
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
    await page.goto("/fr/homelab");
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
    await page.goto("/en/homelab");
    await expect(page.getByText("The homelab, as it runs")).toBeVisible();
    await expect(page.locator("[data-network] svg:visible").getByText("Hypervisor").first()).toBeVisible();
  });
});

test.describe("the network map without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("is simply there, drawn", async ({ page }) => {
    await page.goto("/fr/homelab");
    const map = page.locator("[data-network]");
    await expect(map).not.toHaveAttribute("data-armed", "");
    await expect(map.locator("svg:visible").getByText("host-fixture", { exact: true })).toBeVisible();
  });
});

test.describe("the creative stations' video preview, tracked", () => {
  const PREVIEW = "/media/fixtures/film-preview.webm";
  const station = (page: Page) => page.locator('[data-station="film-test"]');
  const video = (page: Page) => station(page).locator("video");
  const paused = (page: Page) => video(page).evaluate((v: HTMLVideoElement) => v.paused);
  const button = (page: Page) => page.getByRole("button", { name: "Aperçu — Film test" });
  /** Presses the button from the keyboard: no pointer passes over the station on the way. */
  const press = async (page: Page) => {
    await button(page).focus();
    await page.keyboard.press("Enter");
  };
  /** Puts the mouse in the middle of the station's image — under its link, as a visitor's would be. */
  const hoverImage = async (page: Page) => {
    const box = (await station(page).locator("img").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  };

  /** Records every request for the clip. */
  function clipRequests(page: Page) {
    const seen: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes(PREVIEW)) seen.push(request.url());
    });
    return seen;
  }

  test("loads nothing until asked; its button plays and stops it, without leaving the chapter", async ({ page }) => {
    const requests = clipRequests(page);
    await page.goto("/fr/creatif");
    await expect(button(page)).toHaveAttribute("aria-pressed", "false");
    await page.waitForLoadState("networkidle");
    expect(requests).toEqual([]);

    await press(page);
    await expect.poll(() => paused(page)).toBe(false);
    await expect.poll(() => video(page).evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.3);
    await expect(button(page)).toHaveAttribute("aria-pressed", "true");
    await expect(station(page).locator("[data-preview]")).toHaveAttribute("data-playing", "");
    expect(requests.length).toBeGreaterThan(0);
    await expect(page).toHaveURL(/\/fr\/creatif$/);

    await press(page);
    await expect.poll(() => paused(page)).toBe(true);
    await expect(button(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("tracks what moves in the clip, boxes drawn from its own frames", async ({ page }) => {
    await page.goto("/fr/creatif");
    await press(page);
    const painted = () =>
      station(page)
        .locator("canvas")
        .evaluate((canvas: HTMLCanvasElement) => {
          const context = canvas.getContext("2d")!;
          const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
          let count = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) count += 1;
          return count;
        });
    await expect.poll(painted, { timeout: 5000 }).toBeGreaterThan(0);
    // Stopped, the tracker wipes its frame: the cover is clean again.
    await press(page);
    await expect.poll(painted).toBe(0);
  });

  test("with a mouse, plays on hover and stops on leaving", async ({ page, isMobile }) => {
    test.skip(isMobile, "no hover on a phone");
    await page.goto("/fr/creatif");
    await hoverImage(page);
    await expect.poll(() => paused(page)).toBe(false);
    await page.mouse.move(0, 0);
    await expect.poll(() => paused(page)).toBe(true);
  });

  test("never plays by itself on a phone", async ({ page, isMobile }) => {
    test.skip(!isMobile, "a phone's behaviour");
    const requests = clipRequests(page);
    await page.goto("/fr/creatif");
    await station(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    expect(await paused(page)).toBe(true);
    expect(requests).toEqual([]);
  });

  test("reduced motion: hovering plays nothing — the button still does", async ({ page, isMobile }) => {
    test.skip(isMobile, "no hover on a phone");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/fr/creatif");
    await hoverImage(page);
    await page.waitForTimeout(500);
    expect(await paused(page)).toBe(true);
    await press(page);
    await expect.poll(() => paused(page)).toBe(false);
  });

  test("is only on the stations that have a clip", async ({ page }) => {
    await page.goto("/fr/dev");
    await expect(page.locator("[data-preview]")).toHaveCount(0);
  });
});

test.describe("every chapter on the smallest phones (320px)", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of ["/fr/dev", "/fr/homelab", "/fr/repair", "/fr/creatif", "/en/dev", "/en/homelab", "/en/repair", "/en/creative"]) {
    test(`${path}: the whole title fits, nothing sticks out`, async ({ page }) => {
      await page.goto(path);
      expect(await horizontalOverflow(page)).toEqual([]);
    });
  }
});

test.describe("a two-part chapter title", () => {
  // On a phone the title is too wide for one line; on a wide screen too, it is that large.
  for (const [path, parts, width] of [
    ["/fr/repair", ["Réparation", "Montage"], 320],
    ["/en/repair", ["Repair", "Build"], 320],
    ["/fr/repair", ["Réparation", "Montage"], 1024],
    ["/fr/repair", ["Réparation", "Montage"], 1440],
  ] as const) {
    test(`${path} @${width}px: a two-part title wraps after its slash, never mid-word`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      const lines = await page.getByRole("heading", { level: 1 }).evaluate((h1, words: string[]) => {
        const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
        const rows: Record<string, number> = {};
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!words.includes(node.textContent!)) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          rows[node.textContent!] = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
        }
        return rows;
      }, [...parts]);
      for (const word of parts) expect(lines[word], word).toBe(1);
    });
  }
});

test.describe("chapter page without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("is complete in the HTML — the repair text reads before any script", async ({ page }) => {
    await page.goto("/fr/repair");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Réparation/Montage");
    await expect(page.getByText("Montage de PC, réparation de PC et de téléphones", { exact: false })).toBeVisible();
  });

  test("draws each cover's blurred preview in its place, straight from the HTML", async ({ page }) => {
    await page.goto("/fr/dev");
    const covers = page.locator("[data-station] img, [data-folder] img");
    expect(await covers.count()).toBeGreaterThan(1);
    for (const style of await covers.evaluateAll((imgs) => imgs.map((img) => img.getAttribute("style") ?? ""))) {
      expect(style).toContain("data:image/webp;base64,");
    }
  });

  test("links from the desk still work", async ({ page }) => {
    await page.goto("/fr");
    await page.locator('[data-chapter-mark="dev"]').click();
    await expect(page).toHaveURL(/\/fr\/dev$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Développement");
  });
});

test.describe("accessibility of every grade (axe, WCAG 2.1 AA)", () => {
  for (const path of ["/fr/dev", "/fr/homelab", "/fr/repair", "/fr/creatif", "/en/dev", "/en/creative"]) {
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
