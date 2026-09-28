import { expect, test, type Page } from "@playwright/test";

/**
 * The drawer, by hand: pulling a chapter down from the top of its page. Real
 * touch events through the DevTools protocol, so the browser's own scrolling
 * takes part exactly as on a phone. Touch devices only.
 */

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "a touch gesture");
});

const FRAME_GROUND = "rgb(246, 246, 244)";
const liveView = (page: Page) => page.locator("[data-stage-views] [data-view]");

async function hydrated(page: Page) {
  await expect(page.getByRole("banner").locator("time")).toBeVisible();
}

/** A finger on the screen: real touch events, as the browser receives them from a phone. */
async function finger(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", x?: number, y?: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: x === undefined ? [] : [{ x, y: y! }] });
  return { send };
}

/** Moves a finger from `from` to `to` (y), in steps of `step` px every 16 ms. Lifts it unless `hold`. */
async function drag(page: Page, from: number, to: number, { step = 12, hold = false, x = 200 } = {}) {
  const { send } = await finger(page);
  await send("touchStart", x, from);
  const direction = Math.sign(to - from);
  for (let y = from + direction * step; direction * (to - y) >= 0; y += direction * step) {
    await send("touchMove", x, y);
    await page.waitForTimeout(16);
  }
  await send("touchMove", x, to);
  if (!hold) await send("touchEnd");
  return send;
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await hydrated(page);
}

test("pulled far enough, a chapter goes back to the desk, focus on its folder", async ({ page }) => {
  await open(page, "/fr/dev");
  const send = await drag(page, 150, 520, { hold: true });

  // Mid-gesture: the chapter follows the finger, the light frame shows above it.
  await expect.poll(() => liveView(page).evaluate((el) => el.style.transform)).toMatch(/^translateY\(\d+px\)$/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(FRAME_GROUND);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await send("touchEnd");
  await expect(page).toHaveURL(/\/fr$/);
  await expect(page.locator("[data-stage-leaving]")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('[data-chapter-mark="dev"]')).toBeFocused();
  await expect(page.locator("html")).not.toHaveAttribute("data-pulling");
});

test("pulled a little, the chapter slides back into place", async ({ page }) => {
  await open(page, "/fr/dev");
  await drag(page, 150, 210);
  await expect.poll(() => liveView(page).evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  await expect(page).toHaveURL(/\/fr\/dev$/);
  await expect(page.locator("html")).not.toHaveAttribute("data-pulling");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).not.toBe(FRAME_GROUND);
});

test("lower down the page, pulling down is just scrolling back up", async ({ page }) => {
  await open(page, "/fr/dev");
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600);

  await drag(page, 200, 500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(600);
  await expect(page).toHaveURL(/\/fr\/dev$/);
  expect(await liveView(page).evaluate((el) => el.style.transform)).toBe("");
});

test("at the top, a swipe up scrolls the chapter as usual", async ({ page }) => {
  await open(page, "/fr/dev");
  await drag(page, 600, 200);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page).toHaveURL(/\/fr\/dev$/);
});

test("the desk and project pages are not pulled", async ({ page }) => {
  await open(page, "/fr");
  await drag(page, 150, 600);
  await expect(page).toHaveURL(/\/fr$/);

  await open(page, "/fr/dev/alpha-app");
  await drag(page, 150, 600);
  await expect(page).toHaveURL(/\/fr\/dev\/alpha-app$/);
});

test("the browser's pull-to-refresh stays out of a chapter, and only a chapter", async ({ page }) => {
  await open(page, "/fr/dev");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY)).toBe("none");
  await open(page, "/fr");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY)).toBe("auto");
});

test("the chapter's footer says it can be pulled, where Escape does not apply", async ({ page }) => {
  await open(page, "/fr/dev");
  const footer = page.getByRole("contentinfo");
  await expect(footer.locator("[data-pull-hint]")).toBeVisible();
  await expect(footer.locator("kbd")).toBeHidden();
});

test("no touch event was cancelled too late: the pull never fights the browser's scroll", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (/cancelable=false|Ignored attempt to cancel/i.test(message.text())) warnings.push(message.text());
  });
  await open(page, "/fr/dev");
  await drag(page, 150, 520);
  await expect(page).toHaveURL(/\/fr$/);
  expect(warnings).toEqual([]);
});
