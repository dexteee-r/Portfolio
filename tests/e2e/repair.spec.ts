import { expect, test } from "@playwright/test";

/**
 * The repair chapter's world, « l'établi » — on the fixture content: two
 * repairs, ecran-fixture (a cover, named parts and a device) then
 * montage-fixture (a cover, no named parts).
 */
test.describe("the workbench", () => {
  test("opens on a reel of diagnostics, then pins every intervention to the board, each a link", async ({ page }) => {
    await page.goto("/fr/repair");
    await expect(page.locator('[data-world="repair"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Réparation/Montage");

    const reel = page.locator("[data-reel]");
    const first = reel.locator("[data-current]");
    await expect(first.getByRole("img", { name: "Capture de test, au format 4:3." })).toBeVisible();
    await expect(first.locator("[data-reel-mark]")).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Voir l'intervention : iPhone 16 Pro Max →" })).toHaveAttribute(
      "href",
      "/fr/repair/ecran-fixture",
    );

    const orders = page.getByRole("list", { name: "Projets" }).getByRole("listitem");
    await expect(orders).toHaveCount(2);
    await expect(orders.first().getByRole("link", { name: "Écran de test" })).toHaveAttribute(
      "href",
      "/fr/repair/ecran-fixture",
    );
    await expect(orders.first().getByText("Remplacement de la vitre arrière")).toBeVisible();
    await expect(orders.first().locator("time")).toHaveAttribute("datetime", "PT2H30M");
  });

  test("goes on to the next repair every 2.5 seconds, the scan starting over on it", async ({ page }) => {
    await page.goto("/fr/repair");
    const reel = page.locator("[data-reel]");
    await reel.scrollIntoViewIfNeeded();
    const count = reel.locator("[data-reel-count]");
    // The line sweeps within each cycle, then the next photo comes.
    await expect(reel.locator(".reel-line")).toHaveCSS("opacity", "1", { timeout: 3000 });
    await expect(count).toHaveText("02 / 02", { timeout: 6000 });
    await expect(page.getByRole("link", { name: "Voir l'intervention : PC de test →" })).toHaveAttribute(
      "href",
      "/fr/repair/montage-fixture",
    );
    await expect(reel.locator("[data-current]").getByRole("img", { name: "Couverture de test." })).toBeVisible();
    // And back to the first.
    await expect(count).toHaveText("01 / 02", { timeout: 4000 });
  });

  test("the pause button holds the reel, and play starts it again", async ({ page }) => {
    await page.goto("/fr/repair");
    const reel = page.locator("[data-reel]");
    const count = reel.locator("[data-reel-count]");
    await reel.getByRole("button", { name: "Pause" }).click();
    await expect(reel.getByRole("button", { name: "Relancer" })).toBeVisible();
    // Move the focus away: a focused reel holds anyway.
    await page.getByRole("heading", { level: 1 }).focus();
    // Let a change of photo already under way land before reading which one is held.
    await page.waitForTimeout(300);
    const paused = await count.textContent();
    await page.waitForTimeout(3200);
    await expect(count).toHaveText(paused!);
    await reel.getByRole("button", { name: "Relancer" }).click();
    await page.getByRole("heading", { level: 1 }).focus();
    await expect(count).not.toHaveText(paused!, { timeout: 4000 });
  });

  test("an order opens its repair", async ({ page }) => {
    await page.goto("/fr/repair");
    await page.getByRole("list", { name: "Projets" }).getByRole("link", { name: "Écran de test" }).click();
    await expect(page).toHaveURL(/\/fr\/repair\/ecran-fixture$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Écran de test");
  });

  test("has no drawer: the board is the index", async ({ page }) => {
    await page.goto("/fr/repair");
    await expect(page.getByRole("navigation", { name: "Sommaire du dossier" })).toHaveCount(0);
  });

  test("lights the board with WebGL where the browser has it — the CSS board stays under it either way", async ({
    page,
  }) => {
    await page.goto("/fr/repair");
    const light = page.locator("[data-workbench-light]");
    await expect(light).toHaveAttribute("aria-hidden", "true");
    const webgl = await page.evaluate(() => Boolean(document.createElement("canvas").getContext("webgl2")));
    if (webgl) await expect(light).toHaveAttribute("data-lit", "", { timeout: 5000 });
    // The pegboard drawn in CSS: what shows without WebGL, and under the lamp until it is lit.
    const board = await page.locator(".workbench").evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(board).toContain("radial-gradient");
  });

  test("with a mouse, a lens shows the X-ray under the pointer", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "the lens follows a mouse");
    await page.goto("/fr/repair");
    const frame = page.locator("[data-reel] [data-lens]");
    await expect(frame).toHaveCount(1, { timeout: 5000 });
    await expect(frame).toHaveCSS("cursor", "crosshair");
    // While the lens is used, the reel waits.
    const box = (await frame.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const count = page.locator("[data-reel-count]");
    await page.waitForTimeout(300);
    const held = await count.textContent();
    await page.waitForTimeout(3200);
    await expect(count).toHaveText(held!);
  });

  test("on a touch screen, no lens: a finger would hide what it shows", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "a phone");
    await page.goto("/fr/repair");
    await page.waitForTimeout(800);
    await expect(page.locator("[data-reel] [data-lens]")).toHaveCount(0);
  });

  test("speaks English on the English page", async ({ page }) => {
    await page.goto("/en/repair");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Repair/Build");
    await expect(page.getByRole("link", { name: "See the repair: iPhone 16 Pro Max →" })).toBeVisible();
  });
});

test.describe("the workbench under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("pins nothing: every order simply hangs there", async ({ page }) => {
    await page.goto("/fr/repair");
    await expect(page.getByRole("list", { name: "Projets" })).toBeVisible();
    await expect(page.locator("[data-board]")).not.toHaveAttribute("data-armed", "");
  });

  test("the reel stands still on the first repair, its parts drawn, until asked to play", async ({ page }) => {
    await page.goto("/fr/repair");
    const reel = page.locator("[data-reel]");
    await expect(reel.getByRole("button", { name: "Relancer" })).toBeVisible();
    await expect(reel.locator("[data-current] [data-reel-mark][data-locked]")).toHaveCount(2);
    await page.waitForTimeout(3200);
    await expect(reel.locator("[data-reel-count]")).toHaveText("01 / 02");
  });
});

test.describe("the workbench without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("is complete in the HTML: the first diagnostic, its named parts, every order and its link", async ({ page }) => {
    await page.goto("/fr/repair");
    await expect(page.locator("[data-reel] [data-current] img")).toBeVisible();
    await expect(page.locator("[data-reel] [data-current] [data-reel-mark]")).toHaveCount(2);
    await expect(page.getByRole("list", { name: "Projets" }).getByRole("link", { name: "Écran de test" })).toBeVisible();
    // No canvas: nothing to draw without the script.
    await expect(page.locator("canvas")).toHaveCount(0);
  });
});
