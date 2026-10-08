import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { OWN_RULE_HEADERS, OWN_RULE_PATHS, SECURITY_HEADERS, SITE_PATHS } from "@/security-headers";

const header = (key: string) => SECURITY_HEADERS.find((h) => h.key === key)?.value;

/** Next's own path matching, approximated: the negative lookahead of SITE_PATHS on a pathname. */
const sitePath = new RegExp(`^/${SITE_PATHS.slice("/:path(".length, -1)}$`);

describe("security headers", () => {
  it("are sent with every page and file", async () => {
    const rules = await nextConfig.headers!();
    const site = rules.find((rule) => rule.source === SITE_PATHS);
    for (const h of SECURITY_HEADERS) expect(site?.headers, h.key).toContainEqual(h);
  });

  it("cover every path but the CMS panel and its sign-in", () => {
    for (const path of ["/", "/fr", "/en/legal-notice", "/media/a.webp", "/_next/image", "/api/other", "/administration"]) {
      expect(sitePath.test(path), path).toBe(true);
    }
    for (const path of ["/admin", "/admin/sveltia-cms.js", "/api/cms/auth", "/api/cms/callback"]) {
      expect(sitePath.test(path), path).toBe(false);
    }
  });

  it("leave the panel and the sign-in their own stricter framing and referrer rules", async () => {
    const rules = await nextConfig.headers!();
    for (const source of OWN_RULE_PATHS) {
      const own = rules.find((rule) => rule.source === source)!;
      const keys = own.headers.map((h) => h.key);
      expect(keys, source).not.toContain("Content-Security-Policy");
      expect(keys, source).not.toContain("Referrer-Policy");
      expect(own.headers, source).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
      expect(own.headers, source).toContainEqual({ key: "X-Content-Type-Options", value: "nosniff" });
    }
    expect(OWN_RULE_HEADERS.find((h) => h.key === "Permissions-Policy")).toBeDefined();
  });

  it("let no other site frame the pages, nor redirect their base, plugins or forms", () => {
    const csp = header("Content-Security-Policy")!;
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(header("X-Frame-Options")).toBe("SAMEORIGIN");
  });

  it("never let a file be sniffed, nor a page leak its full address to another site", () => {
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("grant no page the camera, microphone, location, payment or USB", () => {
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      expect(header("Permissions-Policy")).toContain(`${feature}=()`);
    }
  });

  it("keep the CMS sign-in popup working: no cross-origin opener policy", () => {
    expect(header("Cross-Origin-Opener-Policy")).toBeUndefined();
  });
});
