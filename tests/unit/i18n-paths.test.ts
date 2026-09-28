import { describe, expect, it } from "vitest";
import { chapterFromSlug, chapterIds, chapterSlugs } from "@/content/chapters";
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
    expect(chapterPath("fr", "infra")).toBe("/fr/infra");
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
