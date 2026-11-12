import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow } from "./helpers";

/**
 * The Homelab chapter's world, « console phosphore » — on the fixture
 * content: Internet › Box › two machines. host-fixture (a mini PC, its
 * hardware and zone, the homelab-fixture project) hosts a proxy and
 * site-fixture (linked to alpha-app), which hosts app-fixture; store-fixture
 * (a plain box) names a draft, so links to nothing here and runs nothing.
 */
const machine = (page: Page, id: string) => page.locator(`[data-machine="${id}"]`);

test.describe("the homelab's machines", () => {
  test("opens on the boot log and the title, then racks every machine with what it runs", async ({ page }) => {
    await page.goto("/fr/homelab");
    await expect(page.locator('[data-world="infra"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Homelab");
    await expect(page.getByText("Baie 01 · 2 machines en service")).toBeVisible();
    const machines = page.getByRole("list", { name: "Machines" }).getByRole("article");
    await expect(machines).toHaveCount(2);
    const host = machine(page, "host");
    await expect(host.getByRole("heading", { level: 2 })).toHaveText("host-fixture");
    await expect(host.getByText("mini-PC de test")).toBeVisible();
    await expect(host.getByText("zone de test, ouverte")).toBeVisible();
    await expect(host.locator('[data-service="site"] [data-service="app"]')).toBeVisible();
    await expect(machine(page, "store")).toContainText("aucun service listé");
  });

  test("a service opens the project that bears its name; a machine naming a draft links nowhere", async ({ page }) => {
    await page.goto("/fr/homelab");
    await expect(machine(page, "store").getByRole("link")).toHaveCount(0);
    await machine(page, "host").locator('[data-service="site"]').getByRole("link", { name: "→ Alpha" }).click();
    await expect(page).toHaveURL(/\/fr\/dev\/alpha-app$/);
  });

  test("a rack on a wide screen, a shelf of silhouettes on a phone — never sticking out", async ({ page, isMobile }) => {
    await page.goto("/fr/homelab");
    const host = machine(page, "host");
    const figure = host.locator(".machine-figure");
    const services = host.locator(".machine-services").first();
    if (isMobile) {
      // The silhouette above the machine's name, its services as a tree under it.
      await expect(figure).toBeVisible();
      await expect(host.locator(".machine-u")).toBeHidden();
      await expect(services).toHaveCSS("display", "grid");
    } else {
      // A unit numbered in the rack, its services as trays across its front.
      await expect(figure).toBeHidden();
      await expect(host.locator(".machine-u")).toHaveText("U01 · 2U");
      await expect(services).toHaveCSS("display", "flex");
    }
    expect(await horizontalOverflow(page)).toEqual([]);
  });

  test("keeps every project of the chapter listed, as folders", async ({ page }) => {
    await page.goto("/fr/homelab");
    const folders = page.getByRole("navigation", { name: "Dossiers du chapitre" }).getByRole("listitem");
    await expect(folders).toHaveCount(1);
    await expect(folders.first().getByRole("link", { name: "Homelab" })).toHaveAttribute("href", "/fr/homelab/homelab-fixture");
  });

  test("speaks the page's language", async ({ page }) => {
    await page.goto("/en/homelab");
    await expect(page.getByText("Rack 01 · 2 machines in service")).toBeVisible();
    await expect(machine(page, "host").getByText("test mini PC")).toBeVisible();
    await expect(machine(page, "host").getByRole("link", { name: "→ Homelab" })).toHaveAttribute("href", "/en/homelab/homelab-fixture");
  });
});

test.describe("the homelab under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("prints the boot log at once, and lights the title without a flicker", async ({ page, isMobile }) => {
    test.skip(isMobile, "the boot log shows on a wide screen");
    await page.goto("/fr/homelab");
    const log = page.locator("[data-boot-log]");
    await expect(log).toContainText("store-fixture");
    await page.waitForTimeout(300);
    await expect(log).toContainText("store-fixture");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("animation-name", "none");
  });
});

test.describe("the homelab without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("is complete in the HTML: the machines, their services and every link", async ({ page }) => {
    await page.goto("/fr/homelab");
    await expect(page.getByRole("list", { name: "Machines" }).getByRole("article")).toHaveCount(2);
    await expect(machine(page, "host").locator("[data-service]")).toHaveCount(3);
    await page.getByRole("link", { name: "Homelab", exact: true }).click();
    await expect(page).toHaveURL(/\/fr\/homelab\/homelab-fixture$/);
  });
});
