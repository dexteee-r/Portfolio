import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

/**
 * The matcher is a path-to-regexp source; for this pattern (a single regex
 * group) it behaves like an anchored JavaScript RegExp. A lost backslash here
 * once made the proxy skip every path longer than one character.
 */
const [source] = config.matcher;
const matches = (path: string) => new RegExp(`^${source}$`).test(path);

describe("proxy matcher", () => {
  it("escapes the dot of the file-extension rule", () => {
    expect(source).toContain("\\.");
  });

  it.each([
    "/",
    "/dev",
    "/dev/mytgc",
    "/EN",
    "/old-page",
    "/fr",
    "/fr/creatif/vlog-malaisie",
    "/administration",
    "/apis",
    "/iconography",
    "/fr/opengraph-image/card",
  ])("runs on %s", (path) => {
    expect(matches(path)).toBe(true);
  });

  it.each([
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/api/health",
    "/admin",
    "/admin/",
    "/admin/config.yml",
    "/robots.txt",
    "/sitemap.xml",
    "/favicon.ico",
    "/media/projects/mytgc/cover.avif",
    "/manifest.webmanifest",
    "/icon/32",
    "/icon/512",
    "/apple-icon",
  ])("skips %s", (path) => {
    expect(matches(path)).toBe(false);
  });
});
