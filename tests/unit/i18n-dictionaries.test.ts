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

  it("carries the identity line from the brief, word for word", () => {
    expect(getDictionary("fr").desk.identity).toBe(
      "Développeur full-stack et infrastructure, en Belgique. Je répare et je filme aussi.",
    );
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
