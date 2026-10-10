import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContentError, loadProjects, localizeProject, parseProject, projectsOf } from "@/content/projects";

const ROOT = join(__dirname, "..", "..");
const FIXTURES = join(ROOT, "tests", "fixtures", "content");

const withCover = (cover: string, extra = "") =>
  `chapter: dev\ncover: ${cover}\n${extra}fr:\n  title: T\n  summary: S\n  coverAlt: Une image.\n`;

describe("cover paths", () => {
  it.each([
    "/media/projects/mytgc/cover.webp",
    "/media/projects/mytgc/cover.avif",
    "/media/projects/mytgc/screen-01.png",
    "/media/fixtures/alpha-cover.webp",
  ])("accepts %s", (cover) => {
    expect(parseProject("x", withCover(cover)).cover).toBe(cover);
  });

  it.each([
    ["a raw JPEG", "/media/projects/x/cover.jpg"],
    ["a JPEG, long form", "/media/projects/x/cover.jpeg"],
    ["uppercase", "/media/projects/x/Cover.webp"],
    ["outside /media", "/images/cover.webp"],
    ["a relative path", "media/cover.webp"],
    ["a parent-directory escape", "/media/../secret.png"],
    ["a remote URL", "https://example.com/cover.webp"],
    ["a missing extension", "/media/projects/x/cover"],
  ])("rejects %s", (_, cover) => {
    expect(() => parseProject("x", withCover(cover))).toThrow(/cover/);
  });

  it("requires a French description of the cover once published", () => {
    const source = "chapter: dev\nstatus: published\ncover: /media/x.webp\nfr:\n  title: T\n  summary: S\n";
    expect(() => parseProject("x", source)).toThrow(/no fr\.coverAlt/);
  });

  it("lets a draft have a cover without a description yet", () => {
    expect(() => parseProject("x", "chapter: dev\ncover: /media/x.webp\n")).not.toThrow();
  });
});

describe("cover files", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "elmzn-covers-"));
    mkdirSync(join(dir, "content", "projects"), { recursive: true });
    mkdirSync(join(dir, "public", "media"), { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("fails the build when a cover points at a missing file", () => {
    writeFileSync(join(dir, "content", "projects", "x.yaml"), withCover("/media/missing.webp"));
    expect(() => loadProjects(join(dir, "content"), join(dir, "public"))).toThrow(ContentError);
    expect(() => loadProjects(join(dir, "content"), join(dir, "public"))).toThrow(
      /x\.yaml: image \/media\/missing\.webp does not exist/,
    );
  });

  it("loads when the file is there", () => {
    writeFileSync(join(dir, "public", "media", "here.webp"), "stub");
    writeFileSync(join(dir, "content", "projects", "x.yaml"), withCover("/media/here.webp"));
    expect(loadProjects(join(dir, "content"), join(dir, "public"))[0]?.cover).toBe("/media/here.webp");
  });
});

describe("covers in fixtures and localisation", () => {
  const projects = loadProjects(FIXTURES);

  it("resolve against the real public folder", () => {
    expect(projects.find((p) => p.slug === "alpha-app")?.cover).toBe("/media/fixtures/alpha-cover.webp");
  });

  it("describe the cover in the language of the card", () => {
    const alpha = projects.find((p) => p.slug === "alpha-app")!;
    expect(localizeProject(alpha, "fr").coverAlt).toBe("Dégradé indigo, image de test.");
    expect(localizeProject(alpha, "en").coverAlt).toBe("Indigo gradient, test image.");
  });

  it("have no cover when none is set", () => {
    const beta = projects.find((p) => p.slug === "beta-tool")!;
    expect(localizeProject(beta, "fr")).toMatchObject({ cover: undefined, coverAlt: "" });
  });

  it("projectsOf keeps one chapter, in station order", () => {
    expect(projectsOf(projects, "dev").map((p) => p.slug)).toEqual(["alpha-app", "beta-tool", "gamma-draft"]);
    expect(projectsOf(projects, "repair").map((p) => p.slug)).toEqual(["ecran-fixture", "montage-fixture"]);
    expect(projectsOf(projects, "creative").map((p) => p.slug)).toEqual(["film-test"]);
  });
});
