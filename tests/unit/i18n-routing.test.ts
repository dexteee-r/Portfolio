import { describe, expect, it } from "vitest";
import { defaultLocale, isLocale, locales, plannedLocales } from "@/i18n/config";
import { localeFromPathname, localeRedirectPath } from "@/i18n/routing";

describe("locale config", () => {
  it("publishes French first, as the default", () => {
    expect(defaultLocale).toBe("fr");
    expect(locales[0]).toBe("fr");
    expect(locales).toContain("en");
  });

  it("keeps Dutch planned but unpublished until proofread", () => {
    expect(plannedLocales).toContain("nl");
    expect(isLocale("nl")).toBe(false);
  });

  it("recognises only exact published locale codes", () => {
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("FR")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale("fr-BE")).toBe(false);
  });
});

describe("localeFromPathname", () => {
  it.each([
    ["/fr", "fr"],
    ["/en/dev", "en"],
    ["/fr/creatif/vlog", "fr"],
    ["/", null],
    ["/dev", null],
    ["/nl/dev", null],
    ["/french", null],
  ])("%s → %s", (path, expected) => {
    expect(localeFromPathname(path)).toBe(expected);
  });
});

describe("localeRedirectPath", () => {
  it("sends the root to the default locale", () => {
    expect(localeRedirectPath("/")).toBe("/fr");
  });

  it("leaves already localized paths alone", () => {
    expect(localeRedirectPath("/fr")).toBeNull();
    expect(localeRedirectPath("/en")).toBeNull();
    expect(localeRedirectPath("/en/dev/mytgc")).toBeNull();
  });

  it("prefixes unlocalized paths with the default locale", () => {
    expect(localeRedirectPath("/dev")).toBe("/fr/dev");
    expect(localeRedirectPath("/dev/schooltrack")).toBe("/fr/dev/schooltrack");
  });

  it("lowercases a miscased locale instead of nesting it", () => {
    expect(localeRedirectPath("/FR")).toBe("/fr");
    expect(localeRedirectPath("/En/dev")).toBe("/en/dev");
  });

  it("does not treat a locale-looking word as a locale", () => {
    expect(localeRedirectPath("/french")).toBe("/fr/french");
    expect(localeRedirectPath("/fr-be/dev")).toBe("/fr/fr-be/dev");
  });

  it("never redirects to an unpublished locale", () => {
    expect(localeRedirectPath("/nl/dev")).toBe("/fr/nl/dev");
  });

  it("is a fixed point: a redirect target never redirects again", () => {
    for (const path of ["/", "/dev", "/FR/x", "/nl", "/a/b/c"]) {
      const target = localeRedirectPath(path);
      expect(target).not.toBeNull();
      expect(localeRedirectPath(target!)).toBeNull();
    }
  });
});
