import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { BOOT_STORAGE_KEY } from "@/lib/boot";
import { site } from "@/site";

/**
 * The privacy note makes promises: no cookie, no analytics, one thing kept in
 * the browser. These tests hold the code to them — adding a tracker or a
 * cookie fails here, until the note says so too.
 */

const SRC = join(__dirname, "..", "..", "src");

function sourceFiles(dir: string = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|mjs|css)$/.test(entry.name) ? [path] : [];
  });
}

const files = sourceFiles().map((path) => ({
  path: relative(SRC, path).split(sep).join("/"),
  text: readFileSync(path, "utf8"),
}));

const using = (pattern: RegExp) => files.filter((file) => pattern.test(file.text)).map((file) => file.path);

describe("what the privacy note promises, the code keeps", () => {
  it("keeps a single thing in the browser: that the opening animation was seen", () => {
    expect(using(/\b(localStorage|sessionStorage|indexedDB)\b/)).toEqual(["lib/boot.ts"]);
    expect(BOOT_STORAGE_KEY).toBe("elmzn.boot");
    expect(getDictionary("fr").legal.storage).toContain("animation d'ouverture");
    expect(getDictionary("en").legal.storage).toContain("opening animation");
  });

  it("sets no cookie on visitors — only the CMS sign-in does, for the site's owner", () => {
    const cookieCode = using(/document\.cookie|cookies\.set\(|cookies\(\)|Set-Cookie/);
    expect(cookieCode.length).toBeGreaterThan(0);
    for (const path of cookieCode) expect(path, path).toMatch(/^(cms\/|app\/api\/cms\/)/);
  });

  it("loads no analytics, tracker or advertising script", () => {
    expect(
      using(/googletagmanager|google-analytics|gtag\(|plausible|umami|hotjar|facebook\.net|fbq\(|clarity\.ms|segment\.(io|com)/i),
    ).toEqual([]);
  });

  it("promises a whole number of months of retention, and was revised on a real date, not in the future", () => {
    expect(Number.isInteger(site.emailRetentionMonths)).toBe(true);
    expect(site.emailRetentionMonths).toBeGreaterThan(0);
    const revised = new Date(`${site.legalUpdated}T00:00:00Z`);
    expect(Number.isNaN(revised.getTime())).toBe(false);
    expect(revised.toISOString().slice(0, 10)).toBe(site.legalUpdated);
    expect(revised.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("promises a whole number of weeks for the server's logs", () => {
    expect(Number.isInteger(site.serverLogRetentionWeeks)).toBe(true);
    expect(site.serverLogRetentionWeeks).toBeGreaterThan(0);
  });

  it("is self-hosted: no hosting company in the code (comments aside — the CMS protocol is Netlify's)", () => {
    const code = files.map((file) => ({ ...file, text: file.text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "") }));
    expect(code.filter((file) => /vercel|netlify|cloudflare/i.test(file.text)).map((file) => file.path)).toEqual([]);
  });

  it("names the remaining providers by their real, secure addresses", () => {
    for (const url of [site.mailHost.url, site.mailInbox.url, site.mailInbox.privacyPolicy, site.sourceCode]) {
      expect(new URL(url).protocol, url).toBe("https:");
    }
  });
});
