import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chapterFromSlug,
  chapterIds,
  chapterSlugRedirects,
  chapterSlugs,
  formerChapterSlugs,
  movedProjectRedirects,
  movedProjects,
} from "@/content/chapters";
import nextConfig from "../../next.config";
import { locales } from "@/i18n/config";
import {
  chapterPath,
  homePath,
  languageAlternates,
  pagePath,
  projectPath,
  switchLocalePath,
} from "@/i18n/paths";

describe("chapter slugs", () => {
  it("match the URLs decided in the brief", () => {
    expect(chapterPath("fr", "dev")).toBe("/fr/dev");
    expect(chapterPath("fr", "infra")).toBe("/fr/homelab");
    expect(chapterPath("en", "infra")).toBe("/en/homelab");
    expect(chapterPath("fr", "repair")).toBe("/fr/repair");
    expect(chapterPath("fr", "creative")).toBe("/fr/creatif");
    expect(chapterPath("en", "creative")).toBe("/en/creative");
  });

  it("are unique within each locale and URL-safe", () => {
    for (const locale of locales) {
      const slugs = chapterIds.map((id) => chapterSlugs[id][locale]);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("round-trip through chapterFromSlug", () => {
    for (const locale of locales) {
      for (const id of chapterIds) {
        expect(chapterFromSlug(locale, chapterSlugs[id][locale])).toBe(id);
      }
    }
    expect(chapterFromSlug("en", "creatif")).toBeNull();
    expect(chapterFromSlug("fr", "nope")).toBeNull();
  });
});

describe("a chapter's former address", () => {
  it("redirects for good to the current one, for the chapter and each of its projects", () => {
    expect(chapterSlugRedirects()).toEqual(
      expect.arrayContaining([
        { source: "/fr/infra", destination: "/fr/homelab", permanent: true },
        { source: "/en/infra", destination: "/en/homelab", permanent: true },
        { source: "/fr/infra/:project", destination: "/fr/homelab/:project", permanent: true },
        { source: "/en/infra/:project", destination: "/en/homelab/:project", permanent: true },
      ]),
    );
  });

  it("is no longer a chapter, never shadows a live one, and never loops", () => {
    for (const locale of locales) {
      const live = new Set(chapterIds.map((id) => chapterSlugs[id][locale]));
      for (const former of Object.values(formerChapterSlugs).flat()) {
        expect(chapterFromSlug(locale, former!), former).toBeNull();
        expect(live.has(former!), former).toBe(false);
      }
    }
    for (const redirect of chapterSlugRedirects()) expect(redirect.destination).not.toBe(redirect.source);
  });

  it("is wired into next.config", async () => {
    expect(await nextConfig.redirects!()).toEqual(expect.arrayContaining(chapterSlugRedirects()));
  });
});

describe("a project's former address", () => {
  it("goes straight to its new one, from the chapter's current segment and its former ones", () => {
    expect(movedProjectRedirects()).toEqual(
      expect.arrayContaining([
        { source: "/fr/homelab/homelab", destination: "/fr/homelab/machines", permanent: true },
        { source: "/en/homelab/homelab", destination: "/en/homelab/machines", permanent: true },
        { source: "/fr/infra/homelab", destination: "/fr/homelab/machines", permanent: true },
        { source: "/en/infra/homelab", destination: "/en/homelab/machines", permanent: true },
      ]),
    );
  });

  it("points at a project that exists, under a name no project uses any more", () => {
    for (const { chapter, from, to } of movedProjects) {
      const moved = join(__dirname, "..", "..", "content", "projects", `${to}.yaml`);
      expect(existsSync(moved), to).toBe(true);
      expect(readFileSync(moved, "utf8")).toMatch(new RegExp(`^\\s+chapter: ${chapter}$`, "m"));
      expect(existsSync(join(__dirname, "..", "..", "content", "projects", `${from}.yaml`)), from).toBe(false);
    }
  });

  it("is matched before the chapter's own redirect, so an old link takes one hop, not two", async () => {
    const sources = (await nextConfig.redirects!()).map((r) => r.source);
    expect(sources.indexOf("/fr/infra/homelab")).toBeGreaterThanOrEqual(0);
    expect(sources.indexOf("/fr/infra/homelab")).toBeLessThan(sources.indexOf("/fr/infra/:project"));
  });
});

describe("path builders", () => {
  it("build home and project paths", () => {
    expect(homePath("en")).toBe("/en");
    expect(projectPath("fr", "dev", "mytgc")).toBe("/fr/dev/mytgc");
    expect(projectPath("en", "creative", "vlog-malaisie")).toBe("/en/creative/vlog-malaisie");
  });
});

describe("switchLocalePath", () => {
  it("switches the desk", () => {
    expect(switchLocalePath("/fr", "en")).toBe("/en");
    expect(switchLocalePath("/en", "fr")).toBe("/fr");
  });

  it("translates chapter slugs and keeps the project slug", () => {
    expect(switchLocalePath("/fr/creatif", "en")).toBe("/en/creative");
    expect(switchLocalePath("/fr/creatif/vlog-malaisie", "en")).toBe("/en/creative/vlog-malaisie");
    expect(switchLocalePath("/en/creative/vlog-malaisie", "fr")).toBe("/fr/creatif/vlog-malaisie");
    expect(switchLocalePath("/fr/dev/mytgc", "en")).toBe("/en/dev/mytgc");
  });

  it("keeps unknown segments as they are", () => {
    expect(switchLocalePath("/fr/whatever/deep", "en")).toBe("/en/whatever/deep");
  });

  it("tolerates trailing slashes", () => {
    expect(switchLocalePath("/fr/creatif/", "en")).toBe("/en/creative");
  });

  it("falls back to the target desk when the path has no locale", () => {
    expect(switchLocalePath("/", "en")).toBe("/en");
    expect(switchLocalePath("/dev", "en")).toBe("/en");
  });

  it("translates the slugs of the frame's pages", () => {
    expect(switchLocalePath("/fr/mentions-legales", "en")).toBe("/en/legal-notice");
    expect(switchLocalePath("/en/legal-notice", "fr")).toBe("/fr/mentions-legales");
    expect(switchLocalePath("/fr/mentions-legales", "fr")).toBe("/fr/mentions-legales");
    expect(switchLocalePath(switchLocalePath(pagePath("fr", "legal"), "en"), "fr")).toBe(pagePath("fr", "legal"));
  });

  it("is reversible for every chapter", () => {
    for (const id of chapterIds) {
      const fr = projectPath("fr", id, "x");
      expect(switchLocalePath(switchLocalePath(fr, "en"), "fr")).toBe(fr);
    }
  });
});

describe("languageAlternates", () => {
  it("lists every published locale plus x-default on the default locale", () => {
    const map = languageAlternates((l) => chapterPath(l, "creative"));
    expect(map).toEqual({
      fr: "/fr/creatif",
      en: "/en/creative",
      "x-default": "/fr/creatif",
    });
  });
});
