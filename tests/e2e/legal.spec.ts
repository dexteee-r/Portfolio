import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow } from "./helpers";

/**
 * The contact footer on every page, the legal notice and its privacy note —
 * and, in a real browser, the truth of what that note promises.
 */

const EMAIL = "contact@elmzn.be";
const PUBLISHER = "Mohamed Mokhtar El Mazani";

/** The clock only renders its time once React has hydrated the page. */
async function hydrated(page: Page) {
  await expect(page.getByRole("banner").locator("time")).toBeVisible();
}

test.describe("the legal notice", () => {
  test("is a complete page in French, at its French address", async ({ page }) => {
    const response = await page.goto("/fr/mentions-legales");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page).toHaveTitle("Mentions légales — ELMZN");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mentions légales");
    await expect(page.getByText(`${PUBLISHER}, à titre personnel`)).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: EMAIL }).first()).toHaveAttribute(
      "href",
      `mailto:${EMAIL}`,
    );
    await expect(page.getByRole("heading", { level: 2, name: "Vos données" })).toBeVisible();
  });

  test("is a complete page in English, at its English address", async ({ page }) => {
    const response = await page.goto("/en/legal-notice");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("Legal notice — ELMZN");
    await expect(page.getByText(`${PUBLISHER}, as a private individual`)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Your data" })).toBeVisible();
  });

  test("names both language versions for search engines", async ({ page }) => {
    await page.goto("/fr/mentions-legales");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://elmzn.be/fr/mentions-legales");
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      "href",
      "https://elmzn.be/en/legal-notice",
    );
  });

  test("under the other language's slug, redirects to the page in the URL's language", async ({ request }) => {
    for (const [from, to] of [
      ["/en/mentions-legales", "/en/legal-notice"],
      ["/fr/legal-notice", "/fr/mentions-legales"],
    ]) {
      const response = await request.get(from!, { maxRedirects: 0 });
      expect(response.status(), from).toBe(308);
      expect(response.headers()["location"], from).toBe(to);
    }
  });

  test("switches language to the other slug", async ({ page }) => {
    await page.goto("/fr/mentions-legales");
    await hydrated(page);
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/legal-notice$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Legal notice");
  });

  test("Escape goes back to the desk", async ({ page }) => {
    await page.goto("/fr/mentions-legales");
    await hydrated(page);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/fr$/);
  });

  test("is readable without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/fr/mentions-legales");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mentions légales");
    await expect(page.getByText("Ce site ne dépose aucun cookie", { exact: false })).toBeVisible();
    await context.close();
  });

  for (const path of ["/fr/mentions-legales", "/en/legal-notice"]) {
    test(`${path} has no accessibility violations (axe, WCAG 2.1 AA)`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    });
  }
});

test.describe("the legal notice on the smallest phones (320px)", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of ["/fr/mentions-legales", "/en/legal-notice"]) {
    test(`${path}: nothing sticks out`, async ({ page }) => {
      await page.goto(path);
      expect(await horizontalOverflow(page)).toEqual([]);
    });
  }
});

test.describe("the contact footer", () => {
  for (const path of ["/fr", "/fr/dev", "/fr/dev/alpha-app", "/fr/mentions-legales", "/fr/nope"]) {
    test(`${path}: the address in clear, the profiles, the legal notice`, async ({ page }) => {
      await page.goto(path);
      const footer = page.getByRole("contentinfo");
      const mail = footer.getByRole("link", { name: EMAIL });
      await expect(mail).toBeVisible();
      await expect(mail).toHaveAttribute("href", `mailto:${EMAIL}`);
      await expect(footer.getByRole("link", { name: /^Instagram/ })).toHaveAttribute(
        "href",
        "https://www.instagram.com/dexteeer.labo/",
      );
      await expect(footer.getByRole("link", { name: /^GitHub/ })).toHaveAttribute("href", "https://github.com/dexteee-r");
      await expect(footer.getByRole("link", { name: "Mentions légales" })).toHaveAttribute(
        "href",
        "/fr/mentions-legales",
      );
    });
  }

  test("the address is in the server's HTML, not assembled by a script", async ({ request }) => {
    const html = await (await request.get("/fr")).text();
    expect(html).toContain(`href="mailto:${EMAIL}"`);
  });

  test("from the desk: the legal notice opens, focus on its title", async ({ page }) => {
    await page.goto("/fr");
    await hydrated(page);
    await page.getByRole("contentinfo").getByRole("link", { name: "Mentions légales" }).click();
    await expect(page).toHaveURL(/\/fr\/mentions-legales$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  });

  test("from a chapter: the drawer closes onto the light frame — no cut — and focus lands on the title", async ({
    page,
  }) => {
    await page.goto("/fr/dev");
    await hydrated(page);
    await page.getByRole("contentinfo").getByRole("link", { name: "Mentions légales" }).click();
    await expect(page).toHaveURL(/\/fr\/mentions-legales$/);
    await expect(page.locator("[data-stage-leaving]")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), { timeout: 5000 })
      .toBe("rgb(246, 246, 244)");
  });
});

test.describe("what the privacy note promises", () => {
  test("no cookie and nothing but the boot flag in storage, after a full visit", async ({ page, context }) => {
    for (const path of ["/fr", "/fr/dev", "/fr/dev/alpha-app", "/en/creative", "/fr/mentions-legales"]) {
      await page.goto(path);
      await hydrated(page);
    }
    expect(await context.cookies()).toEqual([]);
    const stored = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));
    expect(stored.local.every((key) => key === "elmzn.boot")).toBe(true);
    expect(stored.session).toEqual([]);
  });

  test("no request leaves the site while browsing it", async ({ page, baseURL }) => {
    const outside: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== baseURL && url.protocol !== "data:") outside.push(url.href);
    });
    for (const path of ["/fr", "/fr/dev", "/fr/mentions-legales"]) {
      await page.goto(path);
      await hydrated(page);
    }
    expect(outside).toEqual([]);
  });
});
