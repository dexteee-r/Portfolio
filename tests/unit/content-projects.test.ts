import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chapterIds } from "@/content/chapters";
import {
  ContentError,
  contentRoot,
  countByChapter,
  loadProjects,
  localizeProject,
  parseProject,
  showDrafts,
  visibleProjects,
} from "@/content/projects";
import {
  ROLE_MAX_LENGTH,
  STACK_ITEM_MAX_LENGTH,
  STACK_MAX_ITEMS,
  SUMMARY_MAX_LENGTH,
} from "@/content/schema";

const ROOT = join(__dirname, "..", "..");
const FIXTURES = join(ROOT, "tests", "fixtures", "content");
const REAL_CONTENT = join(ROOT, "content");

const minimal = (extra = "") => `chapter: dev\n${extra}fr:\n  title: T\n  summary: S\n`;

describe("parseProject — valid files", () => {
  it("reads shared and translated fields, with defaults", () => {
    const project = parseProject("x", minimal());
    expect(project).toEqual({
      slug: "x",
      chapter: "dev",
      status: "draft",
      order: 100,
      links: [],
      stack: [],
      translations: { fr: { title: "T", summary: "S", body: "", coverAlt: "", role: "" } },
    });
  });

  it("reads shared fields from the default locale block (Sveltia single_file layout)", () => {
    const project = parseProject(
      "x",
      "lang: [fr]\nfr:\n  chapter: infra\n  status: published\n  order: 2\n  title: T\n  summary: S\n",
    );
    expect(project.chapter).toBe("infra");
    expect(project.status).toBe("published");
    expect(project.order).toBe(2);
    expect(project.translations.fr).toEqual({ title: "T", summary: "S", body: "", coverAlt: "", role: "" });
  });

  it("lets top-level shared fields win over duplicated ones", () => {
    const project = parseProject("x", "chapter: repair\nfr:\n  chapter: dev\n  title: T\n");
    expect(project.chapter).toBe("repair");
  });

  it("trims titles and summaries but keeps the Markdown body intact", () => {
    const project = parseProject("x", 'chapter: dev\nfr:\n  title: "  T  "\n  body: "  # H\\n"\n');
    expect(project.translations.fr?.title).toBe("T");
    expect(project.translations.fr?.body).toBe("  # H\n");
  });

  it("accepts a block for a planned locale without publishing it", () => {
    const project = parseProject("x", `${minimal()}nl:\n  title: T\n`);
    expect(Object.keys(project.translations)).toEqual(["fr"]);
  });

  it("accepts typed links", () => {
    const project = parseProject("x", minimal("links:\n  - kind: site\n    url: https://example.com\n"));
    expect(project.links).toEqual([{ kind: "site", url: "https://example.com" }]);
  });

  it("reads the stack as names, trimmed, in order — and an empty one as none", () => {
    const project = parseProject("x", minimal("stack:\n  - ' Next.js '\n  - PostgreSQL\n"));
    expect(project.stack).toEqual(["Next.js", "PostgreSQL"]);
    expect(parseProject("x", minimal("stack:\n")).stack).toEqual([]);
  });

  it("reads the stack from the default locale block too, where Sveltia writes it", () => {
    const project = parseProject("x", "chapter: dev\nfr:\n  title: T\n  summary: S\n  stack: [Rust]\n");
    expect(project.stack).toEqual(["Rust"]);
  });

  it("reads a role in each language", () => {
    const project = parseProject("x", `${minimal()}  role: Développement\nen:\n  title: T\n  summary: S\n  role: Development\n`);
    expect(project.translations.fr?.role).toBe("Développement");
    expect(project.translations.en?.role).toBe("Development");
  });
});

describe("parseProject — rejected files", () => {
  const rejects = (slug: string, source: string, message: RegExp) => {
    expect(() => parseProject(slug, source)).toThrow(ContentError);
    expect(() => parseProject(slug, source)).toThrow(message);
  };

  it("names the file in every error", () => {
    expect(() => parseProject("x", "chapter: nope\n", "content/projects/x.yaml")).toThrow(
      /^content\/projects\/x\.yaml: /,
    );
  });

  it("rejects file names that would make bad URLs", () => {
    for (const slug of ["My Project", "UPPER", "double--dash", "-edge", "accenté", "a_b"]) {
      rejects(slug, minimal(), /not a valid slug/);
    }
  });

  it("rejects invalid YAML", () => rejects("x", "chapter: [dev\n", /invalid YAML/));
  it("rejects a file that is not a mapping", () => rejects("x", "- a\n- b\n", /mapping/));
  it("rejects an empty file", () => rejects("x", "", /mapping/));
  it("rejects an unknown chapter", () => rejects("x", "chapter: cooking\n", /chapter/));
  it("rejects a missing chapter", () => rejects("x", "fr:\n  title: T\n", /chapter/));
  it("rejects an unknown status", () => rejects("x", minimal("status: live\n"), /status/));
  it("rejects a negative or fractional order", () => {
    rejects("x", minimal("order: -1\n"), /order/);
    rejects("x", minimal("order: 1.5\n"), /order/);
  });
  it("rejects a quoted number for order", () => rejects("x", minimal('order: "1"\n'), /order/));
  it("rejects typos at the top level", () => rejects("x", minimal("chpater: dev\n"), /unknown field\(s\): chpater/));
  it("rejects typos inside a locale block", () =>
    rejects("x", "chapter: dev\nfr:\n  titel: T\n", /unknown field\(s\) in "fr": titel/));
  it("rejects a locale block that is not a mapping", () => rejects("x", "chapter: dev\nen: hello\n", /"en" must be a mapping/));
  it("rejects links to non-http URLs or unknown kinds", () => {
    rejects("x", minimal("links:\n  - kind: site\n    url: javascript:alert(1)\n"), /url/);
    rejects("x", minimal("links:\n  - kind: tiktok\n    url: https://x.com\n"), /kind/);
  });
  it("rejects a summary that no longer fits a station", () => {
    const long = "a".repeat(SUMMARY_MAX_LENGTH + 1);
    rejects("x", `chapter: dev\nfr:\n  title: T\n  summary: ${long}\n`, /summary/);
  });
  it("rejects a role that is a paragraph rather than a line", () => {
    rejects("x", `${minimal()}  role: ${"a".repeat(ROLE_MAX_LENGTH + 1)}\n`, /role/);
  });
  it("rejects a stack that lists everything, a name too long, an empty one, or the same twice", () => {
    const list = (names: string[]) => minimal(`stack:\n${names.map((n) => `  - "${n}"\n`).join("")}`);
    rejects("x", list(Array.from({ length: STACK_MAX_ITEMS + 1 }, (_, i) => `T${i}`)), /stack/);
    rejects("x", list(["a".repeat(STACK_ITEM_MAX_LENGTH + 1)]), /stack/);
    rejects("x", list(["Next.js", " "]), /stack/);
    rejects("x", list(["Docker", "docker"]), /twice/);
    rejects("x", minimal("stack: Next.js\n"), /stack/);
  });

  it("refuses to publish a project without a French title and summary", () => {
    rejects("x", "chapter: dev\nstatus: published\nfr:\n  title: T\n", /no fr\.summary/);
    rejects("x", "chapter: dev\nstatus: published\nfr:\n  summary: S\n", /no fr\.title/);
    rejects("x", "chapter: dev\nstatus: published\nen:\n  title: T\n  summary: S\n", /no fr\.title/);
  });

  it("lets a draft be incomplete", () => {
    expect(() => parseProject("x", "chapter: dev\nstatus: draft\n")).not.toThrow();
  });
});

describe("loadProjects", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "elmzn-content-"));
    mkdirSync(join(dir, "projects"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const write = (file: string, text: string) => writeFileSync(join(dir, "projects", file), text);

  it("returns nothing when there is no projects folder", () => {
    expect(loadProjects(join(dir, "missing"))).toEqual([]);
  });

  it("reads .yaml and .yml, ignores other files", () => {
    write("a.yaml", minimal());
    write("b.yml", minimal());
    write("README.md", "# notes");
    write(".DS_Store", "");
    expect(loadProjects(dir).map((p) => p.slug)).toEqual(["a", "b"]);
  });

  it("refuses two files for the same project", () => {
    write("a.yaml", minimal());
    write("a.yml", minimal());
    expect(() => loadProjects(dir)).toThrow(/duplicates/);
  });

  it("fails loudly on a single broken file instead of dropping it", () => {
    write("good.yaml", minimal());
    write("bad.yaml", "chapter: nope\n");
    expect(() => loadProjects(dir)).toThrow(/bad\.yaml/);
  });

  it("sorts by chapter, then order, then slug", () => {
    write("z.yaml", "chapter: creative\norder: 1\n");
    write("b.yaml", "chapter: dev\norder: 2\n");
    write("a.yaml", "chapter: dev\norder: 2\n");
    write("c.yaml", "chapter: dev\norder: 1\n");
    write("i.yaml", "chapter: infra\norder: 0\n");
    expect(loadProjects(dir).map((p) => p.slug)).toEqual(["c", "a", "b", "i", "z"]);
  });
});

describe("fixtures", () => {
  const projects = loadProjects(FIXTURES);

  it("load without error", () => {
    expect(projects.map((p) => p.slug)).toEqual([
      "alpha-app",
      "beta-tool",
      "gamma-draft",
      "homelab-fixture",
      "film-test",
    ]);
  });

  it("count only published projects, and every chapter appears", () => {
    expect(countByChapter(projects)).toEqual({ dev: 2, infra: 1, repair: 0, creative: 1 });
    expect(Object.keys(countByChapter([])).sort()).toEqual([...chapterIds].sort());
  });

  it("hide drafts unless asked", () => {
    expect(visibleProjects(projects, false).map((p) => p.slug)).not.toContain("gamma-draft");
    expect(visibleProjects(projects, true).map((p) => p.slug)).toContain("gamma-draft");
  });
});

describe("localizeProject", () => {
  const projects = loadProjects(FIXTURES);
  const bySlug = (slug: string) => projects.find((p) => p.slug === slug)!;

  it("uses the requested language when it is translated", () => {
    const alpha = localizeProject(bySlug("alpha-app"), "en");
    expect(alpha).toMatchObject({ title: "Alpha", lang: "en", bodyLang: "en" });
    expect(alpha.summary).toBe("A test application, fully translated.");
    expect(alpha.body).toContain("Long text in English");
  });

  it("falls back to French as a whole card, and says so", () => {
    const beta = localizeProject(bySlug("beta-tool"), "en");
    expect(beta).toMatchObject({ title: "Bêta", lang: "fr", bodyLang: "fr" });
  });

  it("never mixes languages within a card", () => {
    const project = parseProject("x", "chapter: dev\nfr:\n  title: T\n  summary: S\nen:\n  title: English only\n");
    const card = localizeProject(project, "en");
    expect(card).toMatchObject({ title: "T", summary: "S", lang: "fr" });
  });

  it("carries the stack, the same in every language", () => {
    expect(localizeProject(bySlug("alpha-app"), "fr").stack).toEqual(["Next.js", "PostgreSQL", "Docker"]);
    expect(localizeProject(bySlug("alpha-app"), "en").stack).toEqual(["Next.js", "PostgreSQL", "Docker"]);
  });

  it("uses the role of the requested language, else the French one, and says which", () => {
    expect(localizeProject(bySlug("alpha-app"), "en")).toMatchObject({ role: "Design and development", roleLang: "en" });
    expect(localizeProject(bySlug("beta-tool"), "en")).toMatchObject({ role: "Outil interne, en solo", roleLang: "fr" });
    // A translated card without its own role still borrows the French one.
    const project = parseProject("x", `${minimal()}  role: Rôle\nen:\n  title: T\n  summary: S\n`);
    expect(localizeProject(project, "en")).toMatchObject({ lang: "en", role: "Rôle", roleLang: "fr" });
    expect(localizeProject(parseProject("y", minimal()), "en")).toMatchObject({ role: "" });
  });

  it("uses the slug as a last-resort title for an untitled draft", () => {
    const project = parseProject("untitled-draft", "chapter: dev\n");
    expect(localizeProject(project, "fr").title).toBe("untitled-draft");
  });
});

describe("environment switches", () => {
  it("reads CONTENT_DIR relative to the working directory", () => {
    vi.stubEnv("CONTENT_DIR", "tests/fixtures/content");
    expect(contentRoot()).toBe(join(process.cwd(), "tests", "fixtures", "content"));
    vi.unstubAllEnvs();
  });

  it("shows drafts in development only, or when forced", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(showDrafts()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHOW_DRAFTS", "");
    expect(showDrafts()).toBe(false);
    vi.stubEnv("SHOW_DRAFTS", "1");
    expect(showDrafts()).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("real content/ folder", () => {
  it("is entirely valid — a broken file from the CMS fails CI here", () => {
    expect(() => loadProjects(REAL_CONTENT)).not.toThrow();
  });

  it("covers every chapter", () => {
    const chapters = new Set(loadProjects(REAL_CONTENT).map((p) => p.chapter));
    expect([...chapters].sort()).toEqual([...chapterIds].sort());
  });
});
