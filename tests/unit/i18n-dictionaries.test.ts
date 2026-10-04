import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { formatCount, getDictionary } from "@/i18n/dictionaries";

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Array<[string, string]> {
  return Object.entries(tree).flatMap(([key, value]): Array<[string, string]> =>
    typeof value === "string" ? [[`${prefix}${key}`, value]] : leaves(value, `${prefix}${key}.`),
  );
}

const tree = (locale: (typeof locales)[number]) => getDictionary(locale) as unknown as Tree;

describe("dictionaries", () => {
  const reference = leaves(tree("fr")).map(([key]) => key).sort();

  it.each(locales)("%s has exactly the reference keys", (locale) => {
    const keys = leaves(tree(locale)).map(([key]) => key).sort();
    expect(keys).toEqual(reference);
  });

  it.each(locales)("%s has no empty or untrimmed strings", (locale) => {
    for (const [key, value] of leaves(tree(locale))) {
      expect(value.trim(), key).not.toBe("");
      expect(value, key).toBe(value.trim());
    }
  });

  it.each(locales)("%s keeps {count} in both plural forms", (locale) => {
    const { one, other } = getDictionary(locale).projectCount;
    expect(one).toContain("{count}");
    expect(other).toContain("{count}");
  });

  it("carries the identity line, word for word", () => {
    expect(getDictionary("fr").desk.identity).toBe(
      "Bricoleur du numérique en Belgique : des applis et des sites, un homelab, des PC montés et réparés, des téléphones remis en état. Et je filme aussi.",
    );
  });

  it("never lets the identity line start a row with its colon: a no-break space holds it, as French wants", () => {
    expect(getDictionary("fr").desk.identity).not.toMatch(/ :/);
    expect(getDictionary("fr").meta.description).not.toMatch(/ :/);
  });

  it("introduces its owner as a digital tinkerer, never as a full-stack developer", () => {
    expect(getDictionary("fr").meta.jobTitle).toBe("Bricoleur du numérique");
    expect(getDictionary("en").meta.jobTitle).toBe("Digital tinkerer");
    for (const locale of ["fr", "en"] as const) {
      const { meta, desk } = getDictionary(locale);
      for (const text of [meta.title, meta.description, meta.jobTitle, desk.identity]) {
        expect(text, text).not.toMatch(/full[- ]?stack|développeur|developer/i);
      }
    }
  });

  it("names the repair chapter for both its trades: building PCs, and repairing PCs and phones", () => {
    expect(getDictionary("fr").chapters.repair.name).toBe("Réparation/Montage");
    expect(getDictionary("en").chapters.repair.name).toBe("Repair/Build");
    expect(getDictionary("fr").chapters.repair.description).toMatch(/^Montage de PC, réparation de PC et de téléphones/);
    expect(getDictionary("en").chapters.repair.description).toMatch(/^PC builds, PC and phone repair/);
  });

  it("shows on the homelab only what runs: no monitoring in its description", () => {
    for (const locale of ["fr", "en"] as const) {
      expect(getDictionary(locale).chapters.infra.description).not.toMatch(/supervision|monitoring/i);
    }
  });

  it("calls the infra chapter the homelab, everywhere a visitor reads it", () => {
    for (const locale of ["fr", "en"] as const) {
      const dict = getDictionary(locale);
      expect(dict.chapters.infra.name).toBe("Homelab");
      const visible = [dict.meta.title, dict.meta.description, dict.meta.jobTitle, dict.desk.identity, dict.chapters.infra.description];
      for (const text of visible) expect(text, text).not.toMatch(/infrastructure/i);
    }
  });
});

describe("formatCount", () => {
  const fr = getDictionary("fr").projectCount;
  const en = getDictionary("en").projectCount;

  it("uses French plural rules: 0 and 1 are singular", () => {
    expect(formatCount("fr", 0, fr)).toBe("0 projet");
    expect(formatCount("fr", 1, fr)).toBe("1 projet");
    expect(formatCount("fr", 2, fr)).toBe("2 projets");
    expect(formatCount("fr", 12, fr)).toBe("12 projets");
  });

  it("uses English plural rules: only 1 is singular", () => {
    expect(formatCount("en", 0, en)).toBe("0 projects");
    expect(formatCount("en", 1, en)).toBe("1 project");
    expect(formatCount("en", 3, en)).toBe("3 projects");
  });

  it("replaces every occurrence of {count}", () => {
    expect(formatCount("en", 2, { one: "{count}", other: "{count}/{count}" })).toBe("2/2");
  });
});
