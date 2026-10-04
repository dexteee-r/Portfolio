import { expect, test, type Page } from "@playwright/test";

/**
 * The signature transition, in a real browser. Animations are slowed through
 * the DevTools protocol so the in-between states can be observed reliably.
 */

async function setAnimationRate(page: Page, playbackRate: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate });
  return cdp;
}

/** Records, from the page itself, whether a frozen copy ever appeared. */
async function watchForFrozenCopies(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __frozenSeen: boolean };
    w.__frozenSeen = false;
    new MutationObserver(() => {
      if (document.querySelector("[data-stage-leaving]")) w.__frozenSeen = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
}

const frozenSeen = (page: Page) =>
  page.evaluate(() => (window as unknown as { __frozenSeen: boolean }).__frozenSeen);

const liveView = (page: Page) => page.locator("[data-stage-views] [data-view]");

/** The clock only renders its time once React has hydrated the page. */
async function hydrated(page: Page) {
  await expect(page.getByRole("banner").locator("time")).toBeVisible();
}

/** Loads a page and waits until the drawer can actually run on it. */
async function open(page: Page, path: string) {
  await page.goto(path);
  await hydrated(page);
}

/** The drawer has started: the arriving view is pinned to the viewport. */
async function drawerRunning(page: Page, kind: "frame" | "chapter") {
  await expect(liveView(page)).toHaveAttribute("data-view", kind);
  await expect.poll(() => liveView(page).evaluate((el) => getComputedStyle(el).position)).toBe("fixed");
}

/** Every script error and console error, failed requests included. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

test.describe("drawer: desk → chapter", () => {
  test("the chapter rises over the desk, which recedes; then everything settles", async ({ page }) => {
    const errors = collectErrors(page);
    await open(page, "/fr");
    await setAnimationRate(page, 0.1);

    await page.locator('[data-chapter-mark="dev"]').click();

    // Mid-flight: a frozen desk underneath, the live chapter pinned and moving up.
    const frozen = page.locator("[data-stage-leaving]");
    await expect(frozen).toHaveCount(1);
    await expect(liveView(page)).toHaveAttribute("data-view", "chapter");
    await expect.poll(() => liveView(page).evaluate((el) => getComputedStyle(el).position)).toBe("fixed");

    const midway = await liveView(page).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);
    const height = page.viewportSize()!.height;
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThanOrEqual(height);

    const deskScale = await frozen.evaluate((el) => {
      const running = el.getAnimations();
      return running.length > 0 ? new DOMMatrix(getComputedStyle(el).transform).a : 1;
    });
    expect(deskScale).toBeLessThanOrEqual(1);
    expect(deskScale).toBeGreaterThanOrEqual(0.965);

    // Settled: no copy left, the view back in the flow, focus on the title.
    await expect(frozen).toHaveCount(0, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/fr\/dev$/);
    await expect(liveView(page)).not.toHaveAttribute("style", /.+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("animates transform and opacity only — nothing that repaints the page", async ({ page }) => {
    await open(page, "/fr");
    await setAnimationRate(page, 0.1);
    await page.locator('[data-chapter-mark="infra"]').click();
    await drawerRunning(page, "chapter");

    const properties = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => !(a instanceof CSSTransition))
        .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k))),
    );
    const animated = new Set(properties.filter((p) => !["offset", "computedOffset", "easing", "composite"].includes(p)));
    expect(animated.size).toBeGreaterThan(0);
    for (const property of animated) expect(["transform", "opacity"]).toContain(property);
  });

  test("lands on the top of the chapter even from a scrolled desk", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 500 });
    await open(page, "/fr");
    await page.locator('[data-chapter-mark="creative"]').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.locator('[data-chapter-mark="creative"]').click();
    await expect(page.locator("[data-stage-leaving]")).toHaveCount(0, { timeout: 5000 });
    await expect(page).toHaveURL(/\/fr\/creatif$/);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  });

  test("a double click still makes a single, clean trip", async ({ page }) => {
    const errors = collectErrors(page);
    await open(page, "/fr");
    await watchForFrozenCopies(page);
    const before = await page.evaluate(() => history.length);
    await page.locator('[data-chapter-mark="dev"]').dblclick();
    await expect(page).toHaveURL(/\/fr\/dev$/);
    await expect(page.locator("[data-stage-leaving]")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
    expect(errors).toEqual([]);
  });
});

test.describe("drawer: chapter → desk", () => {
  test("Escape closes the chapter and gives focus back to its folder", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard");
    await open(page, "/fr");
    await page.locator('[data-chapter-mark="repair"]').click();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.locator("[data-stage-leaving]")).toHaveCount(0);
    await expect(page.locator('[data-chapter-mark="repair"]')).toBeFocused();
  });

  test("the chapter slides back down over a desk that comes forward", async ({ page }) => {
    await open(page, "/fr/dev");
    await setAnimationRate(page, 0.1);
    await page.getByRole("contentinfo").getByRole("link", { name: "Retour au bureau" }).click();

    const frozen = page.locator("[data-stage-leaving]");
    await expect(frozen).toHaveCount(1);
    await drawerRunning(page, "frame");
    // The chapter copy is the sheet on top.
    expect(await frozen.evaluate((el) => Number(getComputedStyle(el).zIndex))).toBeGreaterThan(
      await liveView(page).evaluate((el) => Number(getComputedStyle(el).zIndex)),
    );

    await expect(frozen).toHaveCount(0, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.locator('[data-chapter-mark="dev"]')).toBeFocused();
  });

  test("returns the document to the light frame", async ({ page }) => {
    await open(page, "/fr/dev");
    await hydrated(page);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/fr$/);
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), {
        timeout: 5000,
      })
      .toBe("rgb(246, 246, 244)");
  });

  test("the whole keyboard round trip works", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard");
    await open(page, "/fr");
    await page.locator('[data-chapter-mark="infra"]').focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/fr\/homelab$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-chapter-mark="infra"]')).toBeFocused();
  });
});

test.describe("drawer: edge cases", () => {
  test("reduced motion: an instant swap, never a frozen copy, focus still moves", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "/fr");
    await watchForFrozenCopies(page);
    await page.locator('[data-chapter-mark="dev"]').click();
    await expect(page).toHaveURL(/\/fr\/dev$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    expect(await frozenSeen(page)).toBe(false);
  });

  test("frozen animations (a hidden tab) are forced to their end", async ({ page }) => {
    await open(page, "/fr");
    await setAnimationRate(page, 0);
    await page.locator('[data-chapter-mark="dev"]').click();
    await expect(page.locator("[data-stage-leaving]")).toHaveCount(1);
    await expect(page.locator("[data-stage-leaving]")).toHaveCount(0, { timeout: 4000 });
    await expect(liveView(page)).not.toHaveAttribute("style", /.+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  });

  test("the browser's back button after a drawer gives a clean desk", async ({ page }) => {
    await open(page, "/fr");
    await page.locator('[data-chapter-mark="dev"]').click();
    await expect(page).toHaveURL(/\/fr\/dev$/);
    await expect(page.locator("[data-stage-leaving]")).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/fr$/);
    await expect(liveView(page)).toHaveAttribute("data-view", "frame");
    await expect(page.locator("[data-stage-leaving]")).toHaveCount(0);
    await expect(page.locator('[data-chapter-mark="dev"]')).toBeVisible();
  });

  test("the 404's folders lead to their chapter (a separate document: a full load)", async ({ page }) => {
    await open(page, "/fr/nothing-here");
    await page.locator('[data-chapter-mark="infra"]').click();
    await expect(page).toHaveURL(/\/fr\/homelab$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Homelab");
    await expect(page.locator("[data-stage-leaving]")).toHaveCount(0);
  });

  test("switching language inside a chapter is an ordinary navigation", async ({ page }) => {
    await open(page, "/fr/dev");
    await watchForFrozenCopies(page);
    await page.getByRole("navigation", { name: "Langue" }).getByRole("link", { name: /EN/ }).click();
    await expect(page).toHaveURL(/\/en\/dev$/);
    expect(await frozenSeen(page)).toBe(false);
  });
});
