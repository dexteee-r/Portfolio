import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inspectMarkdown } from "@/content/markdown";
import { readDimensions, readImages, readPlaceholders } from "@/content/media";
import { ContentError, loadProjects, mediaOf, parseProject } from "@/content/projects";
import { PREVIEW_MAX_BYTES } from "@/content/schema";

const ROOT = join(__dirname, "..", "..");
const PUBLIC = join(ROOT, "public");

describe("inspectMarkdown", () => {
  it("lists images in order, with their descriptions", () => {
    const { images, problems } = inspectMarkdown(
      "Intro\n\n![Un écran](/media/a.webp)\n\nTexte ![Un autre](/media/b.png \"légende\")",
    );
    expect(images).toEqual([
      { url: "/media/a.webp", alt: "Un écran" },
      { url: "/media/b.png", alt: "Un autre" },
    ]);
    expect(problems).toEqual([]);
  });

  it("treats a reference without definition as plain text, not an image", () => {
    expect(inspectMarkdown("![x][nope]")).toEqual({ images: [], videos: [], problems: [] });
  });

  it("takes a silent clip written like an image, its poster beside it under the same name", () => {
    const { images, videos, problems } = inspectMarkdown('![Le téléphone réparé](/media/p/apres.mp4 "Après")');
    expect(videos).toEqual([{ url: "/media/p/apres.mp4", alt: "Le téléphone réparé", poster: "/media/p/apres.webp" }]);
    // The poster is an image like any other: sized, and checked on disk.
    expect(images).toEqual([{ url: "/media/p/apres.webp", alt: "Le téléphone réparé" }]);
    expect(problems).toEqual([]);
  });

  it("refuses a clip without description", () => {
    expect(inspectMarkdown("![](/media/p/apres.webm)").problems).toEqual([
      'clip "/media/p/apres.webm" has no description (alt text)',
    ]);
  });

  it("follows reference-style images to their definition", () => {
    const { images, problems } = inspectMarkdown("![Écran][s]\n\n[s]: /media/shot.avif");
    expect(images).toEqual([{ url: "/media/shot.avif", alt: "Écran" }]);
    expect(problems).toEqual([]);
  });

  it.each([
    ["a raw JPEG", "![x](/media/a.jpg)", /no JPEG/],
    ["a remote image", "![x](https://cdn.example.com/a.webp)", /no remote file/],
    ["an image outside /media", "![x](/images/a.png)", /must be \/media/],
    ["an image without description", "![](/media/a.webp)", /no description/],
    ["a javascript: link", "[x](javascript:alert(1))", /not http\(s\), mailto or a site path/],
    ["a protocol-relative link", "[x](//evil.example)", /not http\(s\)/],
    ["a data: link", "[x](data:text/html,hi)", /not http\(s\)/],
    ["raw HTML", "Hello <script>alert(1)</script>", /raw HTML is not allowed/],
    ["an HTML block", "<div>hi</div>", /raw HTML/],
  ])("flags %s", (_, markdown, problem) => {
    const { problems } = inspectMarkdown(markdown);
    expect(problems.join("\n")).toMatch(problem);
  });

  it.each([
    "[site](https://example.com)",
    "[mail](mailto:contact@elmzn.be)",
    "[chapitre](/fr/dev)",
    "[plus bas](#choix)",
    "<https://example.com>",
    "a < b et 3 > 2, sans HTML",
  ])("accepts %s", (markdown) => {
    expect(inspectMarkdown(markdown).problems).toEqual([]);
  });
});

describe("project texts at load time", () => {
  it("refuse to parse with an unsafe or unpublishable body, naming the language", () => {
    expect(() => parseProject("x", "chapter: dev\nen:\n  body: '![x](/media/a.jpg)'\n")).toThrow(
      /x\.yaml: en\.body: image "\/media\/a\.jpg"/,
    );
    expect(() => parseProject("x", "chapter: dev\nfr:\n  body: '<b>gras</b>'\n")).toThrow(/fr\.body: raw HTML/);
  });

  it("list every image a project uses, once", () => {
    const project = parseProject(
      "x",
      [
        "chapter: dev",
        "cover: /media/c.webp",
        "fr:",
        "  body: '![a](/media/a.png) ![c](/media/c.webp)'",
        "en:",
        "  body: '![a](/media/a.png)'",
      ].join("\n"),
    );
    expect(mediaOf(project)).toEqual(["/media/c.webp", "/media/a.png"]);
  });

  describe("missing files", () => {
    let dir: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), "elmzn-body-"));
      mkdirSync(join(dir, "content", "projects"), { recursive: true });
      mkdirSync(join(dir, "public", "media"), { recursive: true });
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it("fail the build when a text shows an image that is not there", () => {
      writeFileSync(join(dir, "content", "projects", "x.yaml"), "chapter: dev\nfr:\n  body: '![a](/media/gone.png)'\n");
      expect(() => loadProjects(join(dir, "content"), join(dir, "public"))).toThrow(
        /x\.yaml: image \/media\/gone\.png does not exist/,
      );
    });

    const clipProject = "chapter: repair\nfr:\n  body: '![Le téléphone réparé](/media/apres.mp4)'\n";

    it("fail the build when a text shows a clip without its poster, or a poster without its clip", () => {
      writeFileSync(join(dir, "content", "projects", "x.yaml"), clipProject);
      writeFileSync(join(dir, "public", "media", "apres.mp4"), "clip");
      expect(() => loadProjects(join(dir, "content"), join(dir, "public"))).toThrow(
        /x\.yaml: image \/media\/apres\.webp does not exist/,
      );
      rmSync(join(dir, "public", "media", "apres.mp4"));
      writeFileSync(join(dir, "public", "media", "apres.webp"), "poster");
      expect(() => loadProjects(join(dir, "content"), join(dir, "public"))).toThrow(
        /x\.yaml: clip \/media\/apres\.mp4 does not exist/,
      );
    });

    it("refuse a clip heavier than a station's preview", () => {
      writeFileSync(join(dir, "content", "projects", "x.yaml"), clipProject);
      writeFileSync(join(dir, "public", "media", "apres.webp"), "poster");
      writeFileSync(join(dir, "public", "media", "apres.mp4"), Buffer.alloc(PREVIEW_MAX_BYTES + 1));
      expect(() => loadProjects(join(dir, "content"), join(dir, "public"))).toThrow(
        /x\.yaml: clip \/media\/apres\.mp4 weighs 4\.0 MB — 4 MB at most/,
      );
    });
  });
});

describe("readDimensions", () => {
  it("reads intrinsic sizes from the files (PNG and WebP)", () => {
    expect(readDimensions(["/media/fixtures/alpha-shot.png", "/media/fixtures/alpha-cover.webp"], PUBLIC)).toEqual({
      "/media/fixtures/alpha-shot.png": { width: 1200, height: 900 },
      "/media/fixtures/alpha-cover.webp": { width: 1600, height: 1000 },
    });
  });

  it("returns nothing for nothing", () => {
    expect(readDimensions([], PUBLIC)).toEqual({});
  });

  it("fails clearly on a missing or unreadable file", () => {
    expect(() => readDimensions(["/media/fixtures/none.png"], PUBLIC)).toThrow(ContentError);
    const dir = mkdtempSync(join(tmpdir(), "elmzn-img-"));
    try {
      writeFileSync(join(dir, "fake.png"), "not an image");
      expect(() => readDimensions(["/fake.png"], dir)).toThrow(/cannot read image \/fake\.png/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("readPlaceholders", () => {
  const sources = ["/media/fixtures/alpha-shot.png", "/media/fixtures/alpha-cover.webp"];

  it("draws each image as a tiny WebP, a few hundred bytes inlined in the page", async () => {
    const blurs = await readPlaceholders(sources, PUBLIC);
    expect(Object.keys(blurs)).toEqual(sources);
    for (const blur of Object.values(blurs)) {
      expect(blur).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/);
      expect(blur.length).toBeLessThan(1000);
    }
  });

  it("returns nothing for nothing", async () => {
    expect(await readPlaceholders([], PUBLIC)).toEqual({});
  });

  it("fails clearly on a missing or unreadable file", async () => {
    await expect(readPlaceholders(["/media/fixtures/none.png"], PUBLIC)).rejects.toThrow(
      /cannot read image \/media\/fixtures\/none\.png/,
    );
  });
});

describe("readImages", () => {
  it("gives each image its size and its blurred preview", async () => {
    const images = await readImages(["/media/fixtures/alpha-cover.webp"], PUBLIC);
    expect(images["/media/fixtures/alpha-cover.webp"]).toMatchObject({ width: 1600, height: 1000 });
    expect(images["/media/fixtures/alpha-cover.webp"]!.blur).toMatch(/^data:image\/webp;base64,/);
  });
});
