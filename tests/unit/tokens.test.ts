/**
 * Enforces the rules written at the top of tokens.css, mechanically.
 * If a colour, a chapter or a component changes and breaks one of them, the
 * build goes red instead of the site quietly drifting.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { chapterIds } from "@/content/chapters";
import { contrastRatio } from "@/lib/color";

const ROOT = join(__dirname, "..", "..");
const TOKENS_PATH = join(ROOT, "src", "styles", "tokens.css");
const raw = readFileSync(TOKENS_PATH, "utf8");
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

function declarations(body: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(match[1]!, match[2]!.trim());
  }
  return map;
}

const rootBody = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
const root = declarations(rootBody);

const chapterBlocks = new Map<string, Map<string, string>>();
for (const match of css.matchAll(/\[data-chapter="([\w-]+)"\]\s*\{([^}]*)\}/g)) {
  chapterBlocks.set(match[1]!, declarations(match[2]!));
}

function color(name: string): string {
  const value = root.get(name);
  if (!value) throw new Error(`Missing token ${name}`);
  return value;
}

const AA_TEXT = 4.5;
const AA_GRAPHIC = 3;

describe("tokens.css structure", () => {
  it("defines one block per chapter, matching the chapter registry", () => {
    expect([...chapterBlocks.keys()].sort()).toEqual([...chapterIds].sort());
  });

  it("rule 2: a chapter only re-points the --chapter-* aliases", () => {
    const aliases = [...root.keys()].filter((k) => k.startsWith("--chapter-")).sort();
    expect(aliases.length).toBeGreaterThan(0);
    for (const [id, block] of chapterBlocks) {
      expect([...block.keys()].sort(), id).toEqual(aliases);
    }
  });

  it("rule 2: chapter aliases point at that chapter's own variables", () => {
    for (const [id, block] of chapterBlocks) {
      for (const [alias, value] of block) {
        const suffix = alias.replace("--chapter-", "");
        expect(value, `${id} ${alias}`).toBe(`var(--${id}-${suffix})`);
      }
    }
  });

  it("rule 4: every chapter has a mark for the frame and a full grade", () => {
    for (const id of chapterIds) {
      expect(root.has(`--mark-${id}`), `--mark-${id}`).toBe(true);
      for (const part of ["bg", "surface", "ink", "muted", "accent", "accent-text", "line"]) {
        expect(root.has(`--${id}-${part}`), `--${id}-${part}`).toBe(true);
      }
    }
  });

  it("defaults the aliases to the frame, so the desk needs no data-chapter", () => {
    expect(root.get("--chapter-bg")).toBe("var(--color-ground)");
    expect(root.get("--chapter-ink")).toBe("var(--color-ink)");
  });

  it("gives the document the ground of the chapter view it holds — and nothing else", () => {
    for (const id of chapterIds) {
      const rule = new RegExp(
        `html:has\\(\\[data-chapter="${id}"\\]\\),\\s*html:has\\(\\[data-chapter="${id}"\\]\\) body\\s*\\{([^}]*)\\}`,
      ).exec(css);
      expect(rule, id).not.toBeNull();
      // Ground only: re-pointing the aliases here would repaint a desk still on screen.
      expect(rule![1]!.trim(), id).toBe(`background-color: var(--${id}-bg);`);
    }
  });

  it("keeps a single muted grey on the frame — no third, lighter one", () => {
    const greys = [...root.keys()].filter((k) => /^--color-ink/.test(k));
    expect(greys.sort()).toEqual(["--color-ink", "--color-ink-muted"]);
  });

  it("collapses every duration under prefers-reduced-motion", () => {
    const reduced = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css);
    expect(reduced).not.toBeNull();
    const block = declarations(reduced![1]!);
    for (const name of [...root.keys()].filter((k) => k.startsWith("--duration-"))) {
      expect(block.get(name), name).toBe("1ms");
    }
  });
});

describe("tokens.css contrast (WCAG 2.x, measured)", () => {
  const ground = color("--color-ground");
  const surface = color("--color-surface");

  it("frame text clears AA on ground and surface", () => {
    for (const ink of ["--color-ink", "--color-ink-muted"]) {
      expect(contrastRatio(color(ink), ground), ink).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(color(ink), surface), ink).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it("every chapter mark holds 3:1 on the frame, as a graphic", () => {
    for (const id of chapterIds) {
      expect(contrastRatio(color(`--mark-${id}`), ground), id).toBeGreaterThanOrEqual(AA_GRAPHIC);
      expect(contrastRatio(color(`--mark-${id}`), surface), id).toBeGreaterThanOrEqual(AA_GRAPHIC);
    }
  });

  it.each(chapterIds)("%s: ink, muted and accent-text clear AA on ground AND surface", (id) => {
    for (const bg of [`--${id}-bg`, `--${id}-surface`]) {
      for (const fg of [`--${id}-ink`, `--${id}-muted`, `--${id}-accent-text`]) {
        expect(contrastRatio(color(fg), color(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });

  it.each(chapterIds)("%s: display accent holds 3:1 on its ground", (id) => {
    expect(contrastRatio(color(`--${id}-accent`), color(`--${id}-bg`))).toBeGreaterThanOrEqual(
      AA_GRAPHIC,
    );
  });

  it("every ratio written in a comment is the real, measured one", () => {
    const documented: Array<{ fg: string; bg: string; ratio: number }> = [];

    for (const m of raw.matchAll(/(--color-ink(?:-muted)?)\s+([\d.]+):1/g)) {
      documented.push({ fg: m[1]!, bg: "--color-ground", ratio: Number(m[2]) });
    }
    for (const m of raw.matchAll(
      /(--(dev|infra|repair|creative)-[\w-]+):\s*#[0-9a-f]{6};\s*\/\*\s*([\d.]+):1(?:[^*]*?([\d.]+):1 on surface)?/gi,
    )) {
      documented.push({ fg: m[1]!, bg: `--${m[2]}-bg`, ratio: Number(m[3]) });
      if (m[4]) documented.push({ fg: m[1]!, bg: `--${m[2]}-surface`, ratio: Number(m[4]) });
    }

    expect(documented.length).toBeGreaterThanOrEqual(18);
    for (const { fg, bg, ratio } of documented) {
      const measured = contrastRatio(color(fg), color(bg));
      expect(Math.abs(measured - ratio), `${fg} on ${bg}: says ${ratio}, is ${measured.toFixed(2)}`).toBeLessThan(0.01);
    }
  });
});

describe("components respect the token contract", () => {
  const SRC = join(ROOT, "src");
  const files: string[] = [];
  (function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(tsx?|css)$/.test(entry)) files.push(path);
    }
  })(SRC);

  const outsideTokens = files.filter((f) => f !== TOKENS_PATH);

  it("finds the source files", () => {
    expect(outsideTokens.length).toBeGreaterThan(0);
  });

  it("never reads a chapter's variables directly — only --chapter-* aliases", () => {
    const offenders = outsideTokens.filter((f) =>
      /var\(\s*--(dev|infra|repair|creative)-/.test(readFileSync(f, "utf8")),
    );
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it("hard-codes no colour: every colour comes from tokens.css", () => {
    // src/site.ts holds facts, not styles — and a street address may well
    // contain a "#4133" that reads like a colour.
    const styled = outsideTokens.filter((f) => relative(ROOT, f).split(sep).join("/") !== "src/site.ts");
    const offenders = styled.filter((f) => {
      const text = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      return /#[0-9a-f]{3,8}\b(?![\w-])/i.test(text) || /\brgba?\(/.test(text) || /\bhsla?\(/.test(text);
    });
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });
});
