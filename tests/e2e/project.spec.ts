import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow, settled } from "./helpers";

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
    for (const path of ["/fr/dev/gamma-draft", "/fr/homelab/alpha-app", "/en/creatif/film-test", "/fr/dev/nope"]) {
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
    for (const path of ["/fr/creatif/film-test", "/fr/homelab/homelab-fixture", "/fr/repair/ecran-fixture"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("[data-floppy]"), path).toHaveCount(0);
    }
  });

  test("an infra project keeps a plain spec sheet under its title — the chapter's effect is its map", async ({ page }) => {
    await page.goto("/fr/homelab/homelab-fixture");
    const sheet = page.getByRole("region", { name: "Fiche technique" });
    await expect(sheet.getByRole("term")).toHaveText(["Rôle", "Stack"]);
    await expect(sheet.getByRole("listitem")).toHaveText(["Proxmox VE", "Docker"]);
    await expect(page.locator("[data-floppy], [data-ticket], [data-vhs]")).toHaveCount(0);
  });
});

test.describe("the repair chapter's diagnostic scan", () => {
  const scan = (page: Page) => page.locator("[data-scan]");
  const marks = (page: Page) => page.locator("[data-scan-mark]");
  const opacity = (page: Page, selector: string) =>
    page.locator(selector).first().evaluate((el) => Number(getComputedStyle(el).opacity));

  test("draws the cover at its own proportions, each part boxed where it was drawn", async ({ page }) => {
    await page.goto("/fr/repair/ecran-fixture");
    const photo = page.locator("[data-scan] img");
    await expect(photo).toHaveAttribute("alt", "Capture de test, au format 4:3.");
    const frame = (await photo.boundingBox())!;
    expect(frame.width / frame.height).toBeCloseTo(4 / 3, 2);

    await expect(marks(page)).toHaveText(["01 Vitre arrière", "02 Nappe du flash"]);
    // Its laid-out place, not its painted one: the lock may still be closing in.
    const box = await marks(page)
      .first()
      .evaluate((el: HTMLElement) => {
        const photo = el.offsetParent as HTMLElement;
        return {
          x: el.offsetLeft / photo.clientWidth,
          y: el.offsetTop / photo.clientHeight,
          w: el.offsetWidth / photo.clientWidth,
          h: el.offsetHeight / photo.clientHeight,
        };
      });
    expect(box.x).toBeCloseTo(0.1, 2);
    expect(box.y).toBeCloseTo(0.2, 2);
    expect(box.w).toBeCloseTo(0.4, 2);
    expect(box.h).toBeCloseTo(0.5, 2);
    await expect(scan(page).locator("figcaption")).toHaveText(
      "Pièces repérées sur la photo : Vitre arrière, Nappe du flash.",
    );
  });

  test("sweeps once when it comes into view, then the boxes stay", async ({ page }) => {
    await page.goto("/fr/repair/ecran-fixture");
    await expect(scan(page)).toHaveAttribute("data-armed", "");
    await scan(page).scrollIntoViewIfNeeded();
    await expect(scan(page)).toHaveAttribute("data-scanned", "");
    await expect.poll(() => opacity(page, "[data-scan-mark]:last-of-type [data-scan-label]")).toBe(1);
    await expect.poll(() => opacity(page, "[data-scan] .scan-sweep")).toBe(0);
  });

  test("locks the box at the top before the one lower down", async ({ page }) => {
    await page.goto("/fr/repair/ecran-fixture");
    await scan(page).scrollIntoViewIfNeeded();
    await expect(scan(page)).toHaveAttribute("data-scanned", "");
    const delays = await page.locator("[data-scan] .scan-box").evaluateAll((els) =>
      els.map((el) => Number((el.getAnimations()[0]?.effect?.getComputedTiming().delay as number) ?? -1)),
    );
    // Box 01 starts at 20% of the photo, box 02 at 4%: 02 locks first.
    expect(delays[1]!).toBeLessThan(delays[0]!);
    expect(delays[0]!).toBeCloseTo(1400 * 0.85 * 0.2, 0);
  });

  test("reduced motion: the boxes are simply there", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/fr/repair/ecran-fixture");
    await expect(scan(page)).not.toHaveAttribute("data-armed", "");
    expect(await opacity(page, "[data-scan-label]")).toBe(1);
    expect(await page.locator("[data-scan]").evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  });

  test("the English page scans with the French names, marked as such", async ({ page }) => {
    await page.goto("/en/repair/ecran-fixture");
    await expect(page.locator("[data-scan-label]").first()).toHaveAttribute("lang", "fr");
    await expect(scan(page).locator("figcaption")).toHaveText("Parts spotted on the photo: Vitre arrière, Nappe du flash.");
    await expect(scan(page).locator("[data-scan-count]")).toHaveText("Parts 02");
  });

  test("is the repair chapter's effect only", async ({ page }) => {
    for (const path of ["/fr/dev/alpha-app", "/fr/creatif/film-test"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(scan(page), path).toHaveCount(0);
    }
  });
});

test.describe("the diagnostic scan without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("shows every box, named, on the photo", async ({ page }) => {
    await page.goto("/fr/repair/ecran-fixture");
    await expect(page.locator("[data-scan]")).not.toHaveAttribute("data-armed", "");
    await expect(page.locator("[data-scan-mark]")).toHaveCount(2);
    await expect(page.locator("[data-scan-mark]").first()).toBeVisible();
    expect(await page.locator("[data-scan-mark]").first().evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });
});

test.describe("a clip in a project's text", () => {
  const clip = (page: Page) => page.locator("figure > video");

  test("plays only when asked: silent, with controls, its poster showing until then", async ({ page }) => {
    await page.goto("/fr/repair/ecran-fixture");
    await expect(clip(page)).toHaveAttribute("poster", "/media/fixtures/film-preview.webp");
    await expect(clip(page)).toHaveAttribute("controls", "");
    await expect(clip(page)).toHaveAccessibleName("Le téléphone réparé, son écran d'accueil qui défile");
    await expect(page.locator("figure:has(> video) figcaption")).toHaveText("L'écran neuf répond au doigt.");
    await page.waitForTimeout(500);
    expect(await clip(page).evaluate((v: HTMLVideoElement) => ({ paused: v.paused, muted: v.muted }))).toEqual({
      paused: true,
      muted: true,
    });
    await clip(page).evaluate((v: HTMLVideoElement) => v.play());
    await expect.poll(() => clip(page).evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.1);
  });

  test("holds its place before anything loads: its poster's proportions", async ({ page }) => {
    await page.goto("/fr/repair/ecran-fixture");
    const box = (await clip(page).boundingBox())!;
    expect(box.height / box.width).toBeCloseTo(200 / 320, 1);
  });
});

test.describe("a clip in a project's text, without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("is in the HTML, with its controls", async ({ page }) => {
    await page.goto("/fr/repair/ecran-fixture");
    await expect(page.locator("figure > video")).toHaveAttribute("controls", "");
  });
});

test.describe("the creative chapter's VHS jacket", () => {
  const box = (page: Page) => page.locator("[data-vhs] .vhs-case");
  const transform = (page: Page) => box(page).evaluate((el) => getComputedStyle(el).transform);

  test("heads a creative project: the jacket, then the credits", async ({ page }) => {
    await page.goto("/fr/creatif/film-test");
    const jacket = page.locator("[data-vhs]");
    await expect(jacket).toBeVisible();
    await expect(jacket).toHaveAttribute("aria-hidden", "true");
    await expect(jacket.locator("[data-vhs-meta]")).toHaveText("2024 · 12 min");

    const credits = page.getByRole("region", { name: "Générique" });
    await expect(credits.getByRole("term")).toHaveText(["Année", "Rôle", "Durée", "Matériel"]);
    await expect(credits.locator("time")).toHaveAttribute("datetime", "PT12M");
    await expect(credits.getByRole("listitem")).toHaveText(["Sony A7 IV", "DaVinci Resolve"]);
  });

  test("reads its spine upwards in French, downwards in English", async ({ page }) => {
    const turned = () => page.locator("[data-vhs-spine]").evaluate((el) => getComputedStyle(el).rotate);
    await page.goto("/fr/creatif/film-test");
    expect(await turned()).toBe("180deg");
    await page.goto("/en/creative/film-test");
    expect(await turned()).toBe("none");
  });

  test("asks for the cover once: the box art and the page's cover are the same file", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes(encodeURIComponent("/media/fixtures/film-cover.webp"))) requests.push(request.url());
    });
    await page.goto("/fr/creatif/film-test");
    await page.waitForLoadState("networkidle");
    expect(await page.locator("[data-vhs] img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    expect(new Set(requests).size).toBe(1);
  });

  test("sits under the title: beside its credits on a phone, on the right on a wide screen", async ({ page }) => {
    await page.goto("/fr/creatif/film-test");
    const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    const jacket = (await page.locator("[data-vhs]").boundingBox())!;
    const credits = (await page.locator("[data-specs]").boundingBox())!;
    expect(credits.y).toBeGreaterThan(title.y + title.height);
    if (page.viewportSize()!.width >= 1024) {
      expect(jacket.x).toBeGreaterThan(credits.x + credits.width);
    } else {
      expect(Math.abs(jacket.y - credits.y)).toBeLessThan(2);
      expect(jacket.x + jacket.width).toBeLessThan(credits.x);
    }
  });

  test("turns to face you once — from edge-on — then faces you", async ({ page }) => {
    await page.goto("/fr/creatif/film-test");
    await box(page).evaluate((el) =>
      el.getAnimations().forEach((a) => {
        a.pause();
        a.currentTime = 420; // the end of its delay: the turn begins
      }),
    );
    // Edge-on: the case's width, seen at 80°, is a sliver of itself.
    const width = (await page.locator("[data-vhs]").boundingBox())!.width;
    expect((await box(page).boundingBox())!.width).toBeLessThan(width * 0.3);
    await box(page).evaluate((el) => el.getAnimations().forEach((a) => a.play()));
    await expect.poll(async () => Math.round((await box(page).boundingBox())!.width)).toBe(Math.round(width));
  });

  test("reduced motion: the jacket simply faces you", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/fr/creatif/film-test");
    expect(await box(page).evaluate((el) => el.getAnimations().length)).toBe(0);
    expect(await transform(page)).toBe("none");
  });

  test("the English page names the credits in English", async ({ page }) => {
    await page.goto("/en/creative/film-test");
    const credits = page.getByRole("region", { name: "Credits" });
    await expect(credits.getByRole("term")).toHaveText(["Year", "Role", "Running time", "Gear"]);
    await expect(credits.getByRole("definition").nth(1)).toHaveText("Directing and editing");
  });

  test("is the creative chapter's object only", async ({ page }) => {
    for (const path of ["/fr/dev/alpha-app", "/fr/homelab/homelab-fixture", "/fr/repair/ecran-fixture"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("[data-vhs]"), path).toHaveCount(0);
    }
  });
});

test.describe("the repair chapter's ticket", () => {
  const paper = (page: Page) => page.locator("[data-ticket] .ticket-paper");
  const transform = (page: Page) => paper(page).evaluate((el) => getComputedStyle(el).transform);

  test("heads a repair project: the device in brick, then what was done, how long, when", async ({ page }) => {
    await page.goto("/fr/repair/ecran-fixture");
    const ticket = page.getByRole("region", { name: "Fiche d'intervention" });
    await expect(ticket).toBeVisible();
    await expect(ticket.locator("[data-ticket-number]")).toHaveText("N° 01");
    await expect(ticket.getByRole("term")).toHaveText(["Appareil", "Intervention", "Durée", "Année"]);
    await expect(ticket.getByRole("definition")).toHaveText([
      "iPhone 16 Pro Max",
      "Remplacement de la vitre arrière",
      "2 h 30",
      "2025",
    ]);
    await expect(ticket.locator("time")).toHaveAttribute("datetime", "PT2H30M");
    // The brick of the repair grade, on its own paper — in the display face, not the mono of the ticket.
    const device = ticket.getByText("iPhone 16 Pro Max");
    expect(await device.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(196, 71, 47)");
    const face = (text: string) => ticket.getByText(text).evaluate((el) => getComputedStyle(el).fontFamily);
    expect(await face("iPhone 16 Pro Max")).not.toBe(await face("Appareil"));
  });

  test("sits under the title on a phone, on its right on a wide screen", async ({ page }) => {
    await page.goto("/fr/repair/ecran-fixture");
    const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    const ticket = (await page.locator("[data-ticket]").boundingBox())!;
    if (page.viewportSize()!.width >= 1024) {
      expect(ticket.x).toBeGreaterThan(title.x + title.width);
    } else {
      expect(ticket.y).toBeGreaterThan(title.y + title.height);
    }
  });

  test("comes out of its slot in steps, then hangs there", async ({ page }) => {
    await page.goto("/fr/repair/ecran-fixture");
    const at = (fraction: number) =>
      paper(page).evaluate((el, f) => {
        for (const a of el.getAnimations()) {
          a.pause();
          const { delay = 0, duration = 0 } = a.effect!.getComputedTiming() as { delay?: number; duration?: number };
          a.currentTime = Number(delay) + Number(duration) * f;
        }
      }, fraction);
    const offset = async () => {
      const [, , , , , y] = (await transform(page)).match(/-?[\d.]+/g)!.map(Number);
      return y!;
    };
    const height = (await paper(page).boundingBox())!.height;

    await at(0);
    expect(await offset()).toBeCloseTo(-height, 0); // still inside the printer
    await at(0.5);
    const halfway = await offset();
    expect(halfway).toBeGreaterThan(-height);
    expect(halfway).toBeLessThan(0);
    await at(0.51);
    expect(await offset()).toBe(halfway); // a step, not a glide
    await paper(page).evaluate((el) => el.getAnimations().forEach((a) => a.play()));
    await expect.poll(offset).toBe(0); // out, hanging from the slot
  });

  test("reduced motion: the ticket simply hangs there", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/fr/repair/ecran-fixture");
    expect(await paper(page).evaluate((el) => el.getAnimations().length)).toBe(0);
    expect(await transform(page)).toBe("none");
  });

  test("the English page names the ticket in English, and marks the French intervention", async ({ page }) => {
    await page.goto("/en/repair/ecran-fixture");
    const ticket = page.getByRole("region", { name: "Repair ticket" });
    await expect(ticket.getByRole("term")).toHaveText(["Device", "Repair", "Time", "Year"]);
    await expect(ticket.getByText("Remplacement de la vitre arrière")).toHaveAttribute("lang", "fr");
    await expect(ticket.locator("time")).toHaveText("2 h 30 min");
  });

  test("is the repair chapter's object only", async ({ page }) => {
    for (const path of ["/fr/dev/alpha-app", "/fr/creatif/film-test", "/fr/homelab/homelab-fixture"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("[data-ticket]"), path).toHaveCount(0);
    }
  });
});

test.describe("project pages on the smallest phones (320px)", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of ["/fr/dev/alpha-app", "/en/dev/beta-tool", "/fr/creatif/film-test", "/fr/repair/ecran-fixture"]) {
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
  for (const path of [
    "/fr/dev/alpha-app",
    "/en/dev/alpha-app",
    "/en/dev/beta-tool",
    "/fr/creatif/film-test",
    "/fr/homelab/homelab-fixture",
    "/fr/repair/ecran-fixture",
    "/en/repair/ecran-fixture",
  ]) {
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
