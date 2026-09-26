import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * The CMS runs against a placeholder repository (see playwright.config.ts):
 * these tests boot the real Sveltia panel and walk the real sign-in popup,
 * with GitHub itself replaced by a stand-in. Nothing ever leaves localhost.
 */

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
/** Sveltia wraps interpolated names in invisible bidi isolates (U+2068 … U+2069). */
const SIGN_IN = { name: /^Sign In with ⁨?GitHub⁩?$/ };

interface Isolation {
  /** Every request sent off localhost — all aborted. */
  external: string[];
  /** Where the site sent the visitor to approve access. */
  authorize: URL[];
}

/**
 * What the GitHub stand-in does with a visitor: send them back to the
 * callback with this query string (built from the state it was given), or
 * keep them on the approval page (null).
 */
type GitHubAnswer = (state: string) => string | null;

/**
 * Keeps the browser on localhost. The site's own /api/cms/auth answer is
 * taken as is — its redirect, its state cookie — except that instead of
 * reaching GitHub, the visitor gets GitHub's `answer` straight away.
 * (Playwright cannot intercept the far end of a redirect, so the redirect
 * itself is where GitHub is stood in for.)
 */
async function isolate(context: BrowserContext, baseURL: string, answer: GitHubAnswer = () => null): Promise<Isolation> {
  const seen: Isolation = { external: [], authorize: [] };
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== baseURL) {
      seen.external.push(url.href);
      return route.abort();
    }
    if (url.pathname !== "/api/cms/auth") return route.continue();

    const response = await route.fetch({ maxRedirects: 0 });
    const location = response.headers()["location"] ?? "";
    if (!location.startsWith(`${GITHUB_AUTHORIZE}?`)) return route.fulfill({ response });

    const authorize = new URL(location);
    seen.authorize.push(authorize);
    const back = answer(authorize.searchParams.get("state") ?? "");
    const cookie = { "set-cookie": response.headers()["set-cookie"] ?? "" };
    if (back === null) {
      return route.fulfill({ status: 200, headers: { ...cookie, "content-type": "text/html" }, body: "<p>GitHub</p>" });
    }
    return route.fulfill({
      status: 302,
      headers: { ...cookie, location: `${authorize.searchParams.get("redirect_uri")}?${back}` },
    });
  });
  return seen;
}

const offGitHub = (seen: Isolation) => seen.external.filter((href) => /(^|\.)github\.com$/.test(new URL(href).hostname));

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("CMS panel", () => {
  test("is served from this site, never indexed, never framed", async ({ request }) => {
    const response = await request.get("/admin");
    expect(response.status()).toBe(200);
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(response.headers()["content-security-policy"]).toBe("frame-ancestors 'none'");
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await response.text()).not.toContain("e2e-client-secret");
  });

  test("ships its own copy of Sveltia, cached for good", async ({ request }) => {
    const response = await request.get("/admin/sveltia-cms.js");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("javascript");
    expect(response.headers()["cache-control"]).toContain("immutable");
    expect((await response.body()).byteLength).toBeGreaterThan(1_000_000);
  });

  test("boots on the generated configuration and offers GitHub sign-in, offline", async ({ page, context, baseURL }) => {
    const seen = await isolate(context, baseURL!);
    const errors = watchErrors(page);
    await page.goto("/admin");

    await expect(page.getByRole("button", SIGN_IN)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/errors? in the CMS configuration/i)).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(seen.authorize).toEqual([]);
    expect(offGitHub(seen)).toEqual([]);
  });

  test("is not on the public site: no link to it, not in the sitemap", async ({ request, page }) => {
    await page.goto("/fr");
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain("/admin");
  });
});

test.describe("CMS sign-in", () => {
  /** Clicks sign-in; resolves with the popup the CMS opened. */
  async function signIn(page: Page) {
    const popup = page.waitForEvent("popup");
    await page.getByRole("button", SIGN_IN).click();
    return popup;
  }

  test("sends the visitor to GitHub with this site's app, callback and scope, and a matching state cookie", async ({
    page,
    context,
    baseURL,
  }) => {
    const seen = await isolate(context, baseURL!);
    await page.goto("/admin");
    const popup = await signIn(page);
    await expect(popup.getByText("GitHub")).toBeVisible();

    expect(seen.authorize).toHaveLength(1);
    const authorize = seen.authorize[0]!;
    expect(authorize.searchParams.get("client_id")).toBe("e2e-client-id");
    expect(authorize.searchParams.get("redirect_uri")).toBe(`${baseURL}/api/cms/callback`);
    expect(authorize.searchParams.get("scope")).toBe("repo");
    const state = authorize.searchParams.get("state");
    expect(state).toMatch(/^[0-9a-f]{64}$/);

    const cookie = (await context.cookies()).find((c) => c.name === "elmzn_cms_state");
    expect(cookie).toMatchObject({ value: state, path: "/api/cms", httpOnly: true, sameSite: "Lax" });
    // The page itself cannot read it.
    expect(await popup.evaluate(() => document.cookie)).not.toContain("elmzn_cms_state");
    expect(offGitHub(seen)).toEqual([]);
  });

  test("a sign-in cancelled on GitHub comes back to the panel, in GitHub's words", async ({ page, context, baseURL }) => {
    const seen = await isolate(context, baseURL!, (state) =>
      new URLSearchParams({ error: "access_denied", error_description: "The user has denied access.", state }).toString(),
    );
    await page.goto("/admin");
    await signIn(page);

    await expect(page.getByText("The user has denied access.")).toBeVisible();
    await expect(page.getByRole("button", SIGN_IN)).toBeVisible();
    // The state is single-use: gone once the callback has answered.
    await expect.poll(async () => (await context.cookies()).some((c) => c.name === "elmzn_cms_state")).toBe(false);
    expect(offGitHub(seen)).toEqual([]);
  });

  test("a forged callback is refused before any token is asked for", async ({ page, context, baseURL }) => {
    const seen = await isolate(context, baseURL!, () =>
      new URLSearchParams({ code: "stolen-code", state: "f".repeat(64) }).toString(),
    );
    await page.goto("/admin");
    await signIn(page);

    await expect(page.getByText("Potential CSRF attack detected. Authentication flow aborted.")).toBeVisible();
    await expect(page.getByRole("button", SIGN_IN)).toBeVisible();
    expect(offGitHub(seen)).toEqual([]);
  });
});
