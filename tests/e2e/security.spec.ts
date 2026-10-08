import { expect, test } from "@playwright/test";
import { SECURITY_HEADERS } from "../../src/security-headers";

/**
 * The security headers, as the production server really sends them — on a
 * page, a medium, an image of the optimiser, and the routes that set headers
 * of their own (the CMS panel, its sign-in).
 */

/** Every value a header was sent with: a repeated header arrives as several. */
const values = (headers: Array<{ name: string; value: string }>, name: string) =>
  headers.filter((h) => h.name.toLowerCase() === name.toLowerCase()).map((h) => h.value);

test.describe("security headers", () => {
  for (const path of ["/", "/fr", "/en/legal-notice", "/media/fixtures/alpha-cover.webp", "/robots.txt"]) {
    test(`${path}: all of them`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      const headers = response.headersArray();
      for (const { key, value } of SECURITY_HEADERS) expect(values(headers, key), key).toEqual([value]);
    });
  }

  test("the CMS panel keeps its stricter rule — no frame at all — and gets the others", async ({ request }) => {
    const headers = (await request.get("/admin")).headersArray();
    expect(values(headers, "content-security-policy")).toEqual(["frame-ancestors 'none'"]);
    expect(values(headers, "x-frame-options")).toEqual(["DENY"]);
    expect(values(headers, "x-content-type-options")).toEqual(["nosniff"]);
  });

  test("the sign-in keeps its own referrer rule — the code never leaks — and gets the others", async ({ request }) => {
    const response = await request.get("/api/cms/auth?provider=github", { maxRedirects: 0 });
    const headers = response.headersArray();
    expect(values(headers, "referrer-policy")).toEqual(["no-referrer"]);
    expect(values(headers, "x-frame-options")).toEqual(["DENY"]);
    expect(values(headers, "x-content-type-options")).toEqual(["nosniff"]);
  });

  test("the sign-in popup still has its opener: no cross-origin opener policy", async ({ request }) => {
    const response = await request.get("/api/cms/callback?code=x&state=y");
    expect(values(response.headersArray(), "cross-origin-opener-policy")).toEqual([]);
  });
});
