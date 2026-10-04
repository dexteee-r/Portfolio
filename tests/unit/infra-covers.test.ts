// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { imageSize } from "image-size";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { covers, HEIGHT, WIDTH } from "../../scripts/generate-infra-covers.mjs";
import { chapterSlugs, formerChapterSlugs } from "@/content/chapters";

const ROOT = join(__dirname, "..", "..");
const tokens = readFileSync(join(ROOT, "src", "styles", "tokens.css"), "utf8");
const infraPalette = [...tokens.matchAll(/--infra-[\w-]+:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]!.toLowerCase());

describe("the infra covers (scripts/generate-infra-covers.mjs)", () => {
  it("draws one cover per infra project, at the stations' 16:10", () => {
    expect(Object.keys(covers).sort()).toEqual(["acces-distant", "homelab", "supervision"]);
    expect(WIDTH / HEIGHT).toBe(16 / 10);
    for (const draw of Object.values(covers)) {
      expect(draw()).toContain(`viewBox="0 0 ${WIDTH} ${HEIGHT}"`);
    }
  });

  it("paints in the infra grade only: every colour comes from tokens.css", () => {
    expect(infraPalette.length).toBeGreaterThan(4);
    for (const [slug, draw] of Object.entries(covers)) {
      const colours = [...draw().matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
      for (const colour of new Set(colours)) expect(infraPalette, `${slug}: ${colour}`).toContain(colour);
    }
  });

  it("names the chapter by its current address, never by a former one", () => {
    const chapter = chapterSlugs.infra.fr.toUpperCase();
    for (const [slug, draw] of Object.entries(covers)) {
      const path = /ELMZN \/ ([^/<]+) \/ ([^<]+)</.exec(draw());
      expect(path?.[1], slug).toBe(chapter);
      // The project's own name, not the chapter's again.
      expect(path?.[2], slug).not.toBe(chapter);
      for (const former of formerChapterSlugs.infra ?? []) expect(draw(), slug).not.toContain(`/ ${former.toUpperCase()} /`);
    }
  });

  it("states only facts from the homelab's documentation", () => {
    const homelab = covers.homelab();
    for (const fact of ["Beelink S12", "i7-6700", "ZimaOS", "EXTRANET", "INTRANET"]) expect(homelab).toContain(fact);
  });

  it("draws the monitoring as an illustration: not one figure on it to misread as a measure", () => {
    const words = [...covers.supervision().matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!);
    expect(words).toContain("CPU");
    for (const word of words) expect(word, word).not.toMatch(/\d/);
  });

  it("is in the repository, each cover where its project points, at 1600 × 1000", () => {
    for (const slug of Object.keys(covers)) {
      const project = parse(readFileSync(join(ROOT, "content", "projects", `${slug}.yaml`), "utf8")) as {
        fr: { cover: string; coverAlt: string };
        en: { coverAlt: string };
      };
      expect(project.fr.cover).toBe(`/media/projects/${slug}/cover.webp`);
      expect(project.fr.coverAlt.length).toBeGreaterThan(20);
      expect(project.en.coverAlt.length).toBeGreaterThan(20);
      const file = readFileSync(join(ROOT, "public", project.fr.cover));
      expect(imageSize(file)).toMatchObject({ width: WIDTH, height: HEIGHT, type: "webp" });
    }
  });
});
