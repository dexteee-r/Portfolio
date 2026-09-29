import { expect, test, type Page } from "@playwright/test";

/** A first-time visitor: nothing in storage. */
test.use({ storageState: { cookies: [], origins: [] } });

const MARK_COLORS: Record<string, string> = {
  dev: "rgb(74, 85, 214)",
  infra: "rgb(27, 143, 137)",
  repair: "rgb(178, 61, 38)",
  creative: "rgb(178, 119, 28)",
};

const overlay = (page: Page) => page.locator("[data-boot-overlay]");
const bootState = (page: Page) => page.evaluate(() => document.documentElement.getAttribute("data-boot"));

/**
 * Records, from before any page script runs, when the sequence starts and
 * ends — so its real duration is measured by the page's own clock.
 */
async function recordBoot(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __boot: { start?: number; end?: number } };
    w.__boot = {};
    // Observe the whole document: <html> may not exist yet when this runs.
    new MutationObserver(() => {
      const playing = document.documentElement?.getAttribute("data-boot") === "play";
      if (playing && w.__boot.start === undefined) w.__boot.start = performance.now();
      if (!playing && w.__boot.start !== undefined && w.__boot.end === undefined) w.__boot.end = performance.now();
    }).observe(document, { attributes: true, subtree: true, childList: true, attributeFilter: ["data-boot"] });
  });
}

const recorded = (page: Page) =>
  page.evaluate(() => (window as unknown as { __boot: { start?: number; end?: number } }).__boot);

/** Freezes the CSS part of the sequence (steps 1–3) at one moment of its timeline. */
async function scrubTo(page: Page, ms: number) {
  await page.evaluate((time) => {
    for (const animation of document.getAnimations()) {
      const target = (animation.effect as KeyframeEffect | null)?.target as Element | null;
      if (!target?.closest("[data-boot-overlay]")) continue;
      animation.pause();
      animation.currentTime = time;
    }
  }, ms);
}

/** Waits for the folders to take off, and freezes everything at that instant. */
async function catchTheFlight(page: Page) {
  await page.waitForFunction(
    () => {
      const flying = document
        .getAnimations()
        .some((a) => ((a.effect as KeyframeEffect | null)?.target as Element | null)?.hasAttribute?.("data-boot-fly"));
      if (flying) for (const a of document.getAnimations()) a.pause();
      return flying;
    },
    undefined,
    { polling: "raf", timeout: 8000 },
  );
}

/** Moves every flight to a fraction of its own course (0 = take-off, 1 = landing). */
async function flightAt(page: Page, fraction: number) {
  await page.evaluate((f) => {
    for (const a of document.getAnimations()) {
      const effect = a.effect as KeyframeEffect | null;
      const target = effect?.target as Element | null;
      if (!target?.hasAttribute?.("data-boot-fly")) continue;
      const { delay = 0, duration = 0 } = effect!.getComputedTiming() as { delay?: number; duration?: number };
      a.currentTime = Number(delay) + Math.min(Number(duration) * f, Number(duration) - 1);
    }
  }, fraction);
}

const centreOf = (r: { x: number; y: number; width: number; height: number }) => ({
  x: r.x + r.width / 2,
  y: r.y + r.height / 2,
});

const visibleName = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".boot-name")]
      .filter((n) => Number(getComputedStyle(n).opacity) > 0.5)
      .map((n) => n.textContent),
  );

const opacity = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => Number(getComputedStyle(el).opacity));

const traceOffset = (page: Page) =>
  page.locator(".boot-folder path").first().evaluate((el) => parseFloat(getComputedStyle(el).strokeDashoffset));

test.describe("first visit to the desk", () => {
  test("plays once, in about four seconds, then hands the desk over", async ({ page }) => {
    await recordBoot(page);
    await page.goto("/fr");
    await expect(overlay(page)).toBeVisible();

    await expect.poll(() => bootState(page), { timeout: 8000 }).toBeNull();
    await expect(overlay(page)).toBeHidden();
    const { start, end } = await recorded(page);
    expect(start).toBeDefined();
    expect(end! - start!).toBeGreaterThan(3800);
    expect(end! - start!).toBeLessThan(5000);

    // Remembered: the next load goes straight to the desk.
    await page.reload();
    expect(await bootState(page)).toBeNull();
    await expect(overlay(page)).toBeHidden();
  });

  test("traces, names, then says it — moment by moment", async ({ page }) => {
    await page.goto("/fr");
    await expect(overlay(page)).toBeVisible();

    await scrubTo(page, 450); // tracing; the label already has its first name
    expect(await traceOffset(page)).toBeGreaterThan(0);
    expect(await traceOffset(page)).toBeLessThan(1);
    expect(await visibleName(page)).toEqual(["mytgc"]);

    await scrubTo(page, 800);
    expect(await visibleName(page)).toEqual(["schooltrack"]);
    await scrubTo(page, 1200); // folder drawn
    expect(await traceOffset(page)).toBe(0);
    expect(await visibleName(page)).toEqual(["omniroute"]);
    await scrubTo(page, 1500);
    expect(await visibleName(page)).toEqual(["dexteeer-labo"]);
    expect(await opacity(page, ".boot-phrase")).toBe(0);

    await scrubTo(page, 2600); // the sentence, held
    expect(await opacity(page, ".boot-phrase")).toBe(1);
    await expect(page.locator(".boot-phrase")).toHaveText("Tout commence par un dossier vide.");
    expect(await visibleName(page)).toEqual(["dexteeer-labo"]);
  });

  test("ends with the grey folder becoming the four marks, each landing exactly on its own", async ({ page }) => {
    await page.goto("/fr");
    await catchTheFlight(page);

    // The desk's own folders are hidden while theirs are in the air.
    expect(await opacity(page, '[data-chapter-mark="dev"] svg')).toBe(0);

    const source = (await page.locator(".boot-folder").boundingBox())!;
    const marks: Record<string, { x: number; y: number; width: number; height: number }> = {};
    for (const id of Object.keys(MARK_COLORS)) {
      marks[id] = (await page.locator(`[data-chapter-mark="${id}"] svg`).boundingBox())!;
    }

    // Mid-flight: strictly between the grey folder and the mark.
    await flightAt(page, 0.5);
    for (const id of Object.keys(MARK_COLORS)) {
      const now = centreOf((await page.locator(`[data-boot-fly="${id}"]`).boundingBox())!);
      const from = centreOf(source);
      const to = centreOf(marks[id]!);
      const travelled = Math.hypot(now.x - from.x, now.y - from.y);
      const total = Math.hypot(to.x - from.x, to.y - from.y);
      expect(travelled, id).toBeGreaterThan(0.05 * total);
      expect(travelled, id).toBeLessThan(0.99 * total);
    }

    // Landing: the flying folder covers its mark to the pixel, in the mark's colour.
    await flightAt(page, 1);
    for (const [id, colour] of Object.entries(MARK_COLORS)) {
      const flyer = page.locator(`[data-boot-fly="${id}"]`);
      const landed = (await flyer.boundingBox())!;
      const mark = marks[id]!;
      expect(Math.abs(centreOf(landed).x - centreOf(mark).x), `${id} x`).toBeLessThan(1.5);
      expect(Math.abs(centreOf(landed).y - centreOf(mark).y), `${id} y`).toBeLessThan(1.5);
      expect(Math.abs(landed.width - mark.width), `${id} width`).toBeLessThan(1.5);
      expect(await flyer.locator("svg").evaluate((el) => getComputedStyle(el).color)).toBe(colour);
    }

    // Let it finish: the real folders take over.
    await page.evaluate(() => {
      for (const a of document.getAnimations()) a.play();
    });
    await expect.poll(() => bootState(page), { timeout: 5000 }).toBeNull();
    expect(await opacity(page, '[data-chapter-mark="dev"] svg')).toBe(1);
    await expect(overlay(page)).toBeHidden();
  });

  test("speaks the desk's language", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator(".boot-phrase")).toHaveText("Everything starts with an empty folder.");
  });

  test("keeps the desk readable to assistive technology the whole time", async ({ page }) => {
    await page.goto("/fr");
    await expect(overlay(page)).toBeVisible();
    await expect(overlay(page)).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Markus");
    await expect(page.getByRole("navigation", { name: "Chapitres" }).getByRole("link")).toHaveCount(4);
  });

  test("leaves a working desk behind: the drawer opens a chapter", async ({ page }) => {
    await page.goto("/fr");
    await expect.poll(() => bootState(page), { timeout: 8000 }).toBeNull();
    await page.locator('[data-chapter-mark="dev"]').click();
    await expect(page).toHaveURL(/\/fr\/dev$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  });
});

test.describe("on the smallest phones (320px)", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test("the sentence wraps inside the gutters, nothing sticks out", async ({ page }) => {
    await page.goto("/fr");
    await expect(overlay(page)).toBeVisible();
    await scrubTo(page, 2600);
    const box = (await page.locator(".boot-phrase").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(16);
    expect(box.x + box.width).toBeLessThanOrEqual(320 - 16);
    expect(
      await page.locator(".boot-center *").evaluateAll((els) =>
        els.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.left < 0 || r.right > document.documentElement.clientWidth);
        }).length,
      ),
    ).toBe(0);
  });
});

test.describe("skipping", () => {
  test("any key skips straight to the desk — and still does its job", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard");
    await page.goto("/fr");
    expect(await bootState(page)).toBe("play");
    await page.keyboard.press("Tab");
    expect(await bootState(page)).toBeNull();
    await expect(overlay(page)).toBeHidden();
    await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeFocused();
  });

  test("a click on a folder skips it and opens that chapter", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.getByRole("banner").locator("time")).toBeVisible(); // hydrated
    expect(await bootState(page)).toBe("play");
    await page.locator('[data-chapter-mark="infra"]').click();
    expect(await bootState(page)).toBeNull();
    await expect(page).toHaveURL(/\/fr\/infra$/);
  });

  test("skipping mid-flight leaves a clean desk", async ({ page }) => {
    await page.goto("/fr");
    await catchTheFlight(page);
    await page.mouse.click(5, 5);
    expect(await bootState(page)).toBeNull();
    await expect(overlay(page)).toBeHidden();
    expect(await opacity(page, '[data-chapter-mark="creative"] svg')).toBe(1);
    // Nothing of the sequence still runs. Only the desk's globe may be fading
    // in: it waits for the sequence to end, skipped or not.
    expect(
      await page.evaluate(
        () =>
          document.getAnimations().filter((a) => {
            if (a.playState === "finished" || a.playState === "idle") return false;
            const target = (a.effect as KeyframeEffect | null)?.target;
            return !(target instanceof Element && target.closest("[data-desk-art]"));
          }).length,
      ),
    ).toBe(0);
  });

  test("the desk's globe waits for the sequence, then fades in", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "wide screens with a mouse only");
    await page.goto("/fr");
    await catchTheFlight(page);
    const art = page.locator("[data-desk-art]");
    expect(await art.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
    await page.mouse.click(5, 5);
    await expect.poll(() => art.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });
});

test.describe("when it does not play", () => {
  test("never under prefers-reduced-motion — and it does not count as seen", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/fr");
    expect(await bootState(page)).toBeNull();
    await expect(overlay(page)).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("elmzn.boot"))).toBeNull();
  });

  test("not when the first page is a chapter; the desk plays it on its first load", async ({ page }) => {
    await page.goto("/fr/dev");
    expect(await bootState(page)).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("elmzn.boot"))).toBeNull();

    await page.goto("/fr");
    expect(await bootState(page)).toBe("play");
  });

  test("not when reaching the desk by an in-app navigation", async ({ page }) => {
    await page.goto("/fr/dev");
    await expect(page.getByRole("banner").locator("time")).toBeVisible(); // hydrated
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/fr$/);
    expect(await bootState(page)).toBeNull();
    await expect(overlay(page)).toBeHidden();
  });

  test("goes anyway if animations never run (a tab opened in the background)", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Animation.enable");
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 });
    await page.goto("/fr");
    expect(await bootState(page)).toBe("play");
    await expect.poll(() => bootState(page), { timeout: 8000 }).toBeNull();
    await expect(overlay(page)).toBeHidden();
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("there is no sequence: the desk is simply there", async ({ page }) => {
    await page.goto("/fr");
    await expect(overlay(page)).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await opacity(page, '[data-chapter-mark="dev"] svg')).toBe(1);
  });
});
