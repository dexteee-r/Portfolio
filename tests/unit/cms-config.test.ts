import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { adminPage, BUNDLE_PATH, notConfiguredPage, sveltiaVersion } from "@/cms/admin-page";
import { CMS_AUTH_ENDPOINT, cmsConfig, PROJECT_PUBLIC_FOLDER } from "@/cms/config";
import { chapterIds } from "@/content/chapters";
import { LABEL_MAX_LENGTH, NETWORK_FILE, NETWORK_MAX_NODES, networkKinds } from "@/content/network";
import { loadProjects, parseProject } from "@/content/projects";
import {
  COVER_PATTERN,
  LOCALIZED_KEYS,
  linkKinds,
  projectStatuses,
  SHARED_KEYS,
  SLUG_PATTERN,
  SUMMARY_MAX_LENGTH,
} from "@/content/schema";
import { defaultLocale, locales } from "@/i18n/config";

const ROOT = join(__dirname, "..", "..");
const settings = { repo: "owner/elmzn", branch: "main", baseUrl: "https://elmzn.be", scope: "repo" as const };
const config = cmsConfig(settings);
const collection = config.collections![0] as Record<string, unknown> & { fields: Array<Record<string, unknown>> };
const field = (name: string) => collection.fields.find((f) => f.name === name)!;
const optionValues = (name: string) => (field(name).options as Array<{ value: string }>).map((o) => o.value);

describe("CMS configuration, generated from the content schema", () => {
  it("offers exactly the fields the build validates — no more, no less", () => {
    const names = collection.fields.map((f) => f.name).sort();
    expect(names).toEqual([...SHARED_KEYS, ...LOCALIZED_KEYS].sort());
  });

  it("translates exactly the translatable fields", () => {
    for (const key of LOCALIZED_KEYS) expect(field(key).i18n, key).toBe(true);
    for (const key of SHARED_KEYS) expect(field(key).i18n, key).toBe(false);
  });

  it("offers the real chapters, statuses and link kinds", () => {
    expect(optionValues("chapter")).toEqual([...chapterIds]);
    expect(optionValues("status")).toEqual([...projectStatuses]);
    expect(field("status").default).toBe("draft");
    const kind = (field("links").fields as Array<Record<string, unknown>>).find((f) => f.name === "kind")!;
    expect((kind.options as Array<{ value: string }>).map((o) => o.value)).toEqual([...linkKinds]);
  });

  it("asks for the French title and summary — what publishing needs — and caps the summary", () => {
    expect(field("title").required).toEqual([defaultLocale]);
    expect(field("summary").required).toEqual([defaultLocale]);
    expect(field("summary").maxlength).toBe(SUMMARY_MAX_LENGTH);
  });

  it("stores whole numbers for order and year", () => {
    expect(field("order").value_type).toBe("int");
    expect(field("year").value_type).toBe("int");
  });

  it("only accepts web addresses for links", () => {
    const url = (field("links").fields as Array<Record<string, unknown>>).find((f) => f.name === "url")!;
    const [source] = url.pattern as [string, string];
    expect(new RegExp(source).test("https://example.com")).toBe(true);
    expect(new RegExp(source).test("javascript:alert(1)")).toBe(false);
  });

  it("offers no editor button that would write raw HTML", () => {
    const buttons = field("body").buttons as string[];
    expect(buttons).not.toContain("underline");
    expect(buttons).toContain("link");
  });

  it("writes one YAML file per project, all languages inside, where the loader reads them", () => {
    expect(config.i18n).toMatchObject({ structure: "single_file", locales: [...locales], default_locale: defaultLocale });
    expect(collection).toMatchObject({ folder: "content/projects", format: "yaml", extension: "yaml", i18n: true });
  });

  it("names files as the build names URLs", () => {
    expect(config.slug).toEqual({ encoding: "ascii", clean_accents: true, sanitize_replacement: "-" });
    expect(collection.slug).toBe("{{slug}}");
    expect(SLUG_PATTERN.test("iphone-16-pro-max-vitre-arriere")).toBe(true);
  });

  it("stores each project's images in its own folder, at paths the build accepts", () => {
    const path = `${PROJECT_PUBLIC_FOLDER.replace("{{slug}}", "mytgc")}/img-1234.webp`;
    expect(path).toBe("/media/projects/mytgc/img-1234.webp");
    expect(COVER_PATTERN.test(path)).toBe(true);
  });

  it("turns uploads into what the build accepts: slugified names, WebP, never JPEG", () => {
    const media = (config.media_libraries as { default: { config: Record<string, unknown> } }).default.config;
    expect(media.slugify_filename).toBe(true);
    expect(media.transformations).toMatchObject({ raster_image: { format: "webp" } });
  });

  it("leaves empty optional fields out of the files", () => {
    expect(config.output).toEqual({ omit_empty_optional_fields: true });
  });

  it("signs in through this site's own OAuth endpoints, with the configured scope", () => {
    expect(config.backend).toMatchObject({
      name: "github",
      repo: "owner/elmzn",
      branch: "main",
      base_url: "https://elmzn.be",
      auth_endpoint: CMS_AUTH_ENDPOINT,
      auth_scope: "repo",
    });
    expect(config.load_config_file).toBe(false);
  });
});

describe("the homelab, edited in the CMS", () => {
  const homelab = config.collections!.find((c) => c.name === "homelab") as unknown as {
    files: Array<{ file: string; format: string; fields: Array<Record<string, unknown>> }>;
  };
  const file = homelab.files[0]!;
  const nodes = file.fields.find((f) => f.name === "nodes")! as { fields: Array<Record<string, unknown>>; max: number };
  const nodeField = (name: string) => nodes.fields.find((f) => f.name === name)!;

  it("writes the very file the infra chapter reads", () => {
    expect(file.file).toBe(`content/${NETWORK_FILE.split(/[\\/]/).join("/")}`);
    expect(file.format).toBe("yaml");
  });

  it("offers exactly the fields and kinds the build validates", () => {
    expect(file.fields.map((f) => f.name)).toEqual(["status", "nodes"]);
    expect(nodes.fields.map((f) => f.name)).toEqual(["id", "label", "kind", "parent"]);
    expect((nodeField("kind").options as Array<{ value: string }>).map((o) => o.value)).toEqual([...networkKinds]);
    expect(nodeField("label").maxlength).toBe(LABEL_MAX_LENGTH);
    expect(nodes.max).toBe(NETWORK_MAX_NODES);
    expect(nodeField("parent").required).toBe(false);
  });

  it("starts as a draft, and warns against addresses right where they would be typed", () => {
    expect(file.fields.find((f) => f.name === "status")!.default).toBe("draft");
    expect(String(nodeField("label").hint)).toMatch(/IP/);
  });
});

describe("what the CMS writes, the build reads", () => {
  it("reads a project saved by Sveltia: shared fields inside the default locale block", () => {
    const saved = stringify({
      fr: {
        title: "MyTGC",
        chapter: "dev",
        status: "published",
        order: 1,
        year: 2025,
        summary: "Une application.",
        cover: "/media/projects/mytgc/cover.webp",
        coverAlt: "L'application ouverte sur un téléphone.",
        links: [{ kind: "repo", url: "https://github.com/owner/mytgc" }],
        body: "## Contexte\n\nDu texte.\n",
      },
      en: { title: "MyTGC", summary: "An app.", coverAlt: "The app open on a phone." },
    });
    const project = parseProject("mytgc", saved);
    expect(project).toMatchObject({
      chapter: "dev",
      status: "published",
      order: 1,
      year: 2025,
      cover: "/media/projects/mytgc/cover.webp",
      links: [{ kind: "repo", url: "https://github.com/owner/mytgc" }],
    });
    expect(project.translations.en).toMatchObject({ title: "MyTGC", summary: "An app." });
  });

  it("reads a project whose other language is still empty", () => {
    const saved = stringify({ fr: { title: "T", chapter: "dev", status: "draft", order: 100, summary: "S" }, en: {} });
    expect(() => parseProject("x", saved)).not.toThrow();
  });

  it("treats blank optional fields as absent rather than failing the build", () => {
    const saved = stringify({
      fr: { title: "T", chapter: "infra", status: "draft", order: 3, year: null, cover: "", links: null, summary: "S" },
    });
    const project = parseProject("x", saved);
    expect(project.year).toBeUndefined();
    expect(project.cover).toBeUndefined();
    expect(project.links).toEqual([]);
  });

  it("keeps every real project file in the CMS layout: nothing outside the locale blocks", () => {
    const dir = join(ROOT, "content", "projects");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
      const top = Object.keys(parse(readFileSync(join(dir, file), "utf8")) as Record<string, unknown>);
      for (const key of top) expect(locales as readonly string[], `${file}: "${key}" at the top level`).toContain(key);
      expect(top, file).toContain(defaultLocale);
    }
    expect(loadProjects(join(ROOT, "content")).length).toBeGreaterThan(0);
  });
});

describe("the admin page", () => {
  const html = adminPage(config, "9.9.9");

  it("stops Sveltia from initialising itself before loading it", () => {
    expect(html.indexOf("window.CMS_MANUAL_INIT = true")).toBeGreaterThan(-1);
    expect(html.indexOf("window.CMS_MANUAL_INIT = true")).toBeLessThan(html.indexOf(BUNDLE_PATH));
  });

  it("versions the bundle with the exact installed release", () => {
    const installed = JSON.parse(readFileSync(join(ROOT, "node_modules", "@sveltia", "cms", "package.json"), "utf8"));
    expect(sveltiaVersion()).toMatch(/^\d+\.\d+\.\d+$/); // pinned, no range
    expect(sveltiaVersion()).toBe(installed.version);
    expect(adminPage(config)).toContain(`${BUNDLE_PATH}?v=${installed.version}`);
  });

  it("loads the pinned bundle from this site, versioned", () => {
    expect(html).toContain(`<script src="${BUNDLE_PATH}?v=9.9.9"></script>`);
    expect(html).not.toMatch(/unpkg|jsdelivr|cdn\./);
  });

  it("initialises the CMS with exactly the generated configuration", () => {
    const json = /CMS\.init\(\{ config: (.*) \}\);/.exec(html)![1]!;
    expect(JSON.parse(json)).toEqual(JSON.parse(JSON.stringify(config)));
  });

  it("can never be broken out of its script by the configuration", () => {
    const hostile = adminPage({ ...config, app_title: "</script><script>alert(1)</script>" }, "1");
    expect(hostile.match(/<\/script>/g)).toHaveLength(3); // the three legitimate closings only
  });

  it("is never indexed", () => {
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(notConfiguredPage()).toContain("noindex");
  });

  it("explains itself when the repository is not set", () => {
    expect(notConfiguredPage()).toContain("CMS_GITHUB_REPO");
  });
});
