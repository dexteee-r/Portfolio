import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import { chapterIds, type ChapterId } from "./chapters";
import { inspectMarkdown } from "./markdown";
import {
  ALLOWED_TOP_LEVEL_KEYS,
  LOCALIZED_KEYS,
  localizedFieldsSchema,
  publicationProblems,
  SHARED_KEYS,
  sharedFieldsSchema,
  SLUG_PATTERN,
  type LocalizedFields,
  type Project,
  type ScanMarker,
} from "./schema";

/**
 * A content file that cannot be trusted. Thrown loudly so a broken commit
 * from the CMS fails the build instead of silently dropping a project.
 */
export class ContentError extends Error {
  override name = "ContentError";
}

/** `content/` by default; tests point CONTENT_DIR at their fixtures. */
export function contentRoot(): string {
  const override = process.env.CONTENT_DIR;
  // Statically scoped to content/ so the bundler traces that folder only;
  // the test override is ignored by tracing on purpose.
  return override
    ? path.resolve(/* turbopackIgnore: true */ process.cwd(), override)
    : path.join(process.cwd(), "content");
}

/** Where `/media/…` paths resolve on disk. */
export function publicRoot(): string {
  return path.join(process.cwd(), "public");
}

/**
 * Drafts show in development so work in progress can be previewed, never in a
 * production build unless SHOW_DRAFTS=1 is set explicitly.
 */
export function showDrafts(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.SHOW_DRAFTS === "1";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The listed keys that hold a value. An empty string or a null — what an
 * editor or a hand edit may leave for "nothing" — counts as absent, so an
 * optional field left blank never fails the build.
 */
function pick(source: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = source[key];
    if (key in source && value !== null && value !== "") out[key] = value;
  }
  return out;
}

/**
 * Parses one project file. Accepts both layouts Sveltia CMS can write with the
 * `single_file` i18n structure: shared fields at the top level, or duplicated
 * inside each locale block (read from the default locale's block).
 */
export function parseProject(slug: string, source: string, file = `${slug}.yaml`): Project {
  function fail(message: string): never {
    throw new ContentError(`${file}: ${message}`);
  }

  if (!SLUG_PATTERN.test(slug)) {
    fail(`file name "${slug}" is not a valid slug (lowercase letters, digits and single hyphens)`);
  }

  let data: unknown;
  try {
    data = parse(source);
  } catch (error) {
    fail(`invalid YAML — ${(error as Error).message}`);
  }
  if (!isRecord(data)) fail("expected a YAML mapping at the top level");

  const unknownKeys = Object.keys(data).filter((key) => !ALLOWED_TOP_LEVEL_KEYS.has(key));
  if (unknownKeys.length > 0) fail(`unknown field(s): ${unknownKeys.join(", ")}`);

  const defaultBlock = isRecord(data[defaultLocale]) ? data[defaultLocale] : {};
  const sharedInput = { ...pick(defaultBlock, SHARED_KEYS), ...pick(data, SHARED_KEYS) };
  const shared = sharedFieldsSchema.safeParse(sharedInput);
  if (!shared.success) fail(z.prettifyError(shared.error));

  const translations: Partial<Record<Locale, LocalizedFields>> = {};
  for (const locale of locales) {
    const block = data[locale];
    if (block === undefined || block === null) continue;
    if (!isRecord(block)) fail(`"${locale}" must be a mapping of fields`);
    const extra = Object.keys(block).filter(
      (key) => !(LOCALIZED_KEYS as string[]).includes(key) && !(SHARED_KEYS as string[]).includes(key),
    );
    if (extra.length > 0) fail(`unknown field(s) in "${locale}": ${extra.join(", ")}`);
    const parsed = localizedFieldsSchema.safeParse(pick(block, LOCALIZED_KEYS));
    if (!parsed.success) fail(`in "${locale}": ${z.prettifyError(parsed.error)}`);
    translations[locale] = parsed.data;
  }

  for (const [locale, fields] of Object.entries(translations)) {
    if (fields?.scan.length && !shared.data.cover) fail(`${locale}.scan: the scan is drawn on the cover — add one`);
  }

  for (const [locale, fields] of Object.entries(translations)) {
    if (!fields?.body.trim()) continue;
    const { problems } = inspectMarkdown(fields.body);
    if (problems.length > 0) fail(`${locale}.body: ${problems.join("; ")}`);
  }

  const project: Project = { slug, ...shared.data, translations };
  const problems = publicationProblems(project);
  if (problems.length > 0) fail(problems.join("; "));
  return project;
}

/** Every image a project uses: its cover and the images of each text. */
export function mediaOf(project: Project): string[] {
  const urls = new Set<string>();
  if (project.cover) urls.add(project.cover);
  for (const fields of Object.values(project.translations)) {
    if (!fields?.body.trim()) continue;
    for (const { url } of inspectMarkdown(fields.body).images) urls.add(url);
  }
  return [...urls];
}

function compareProjects(a: Project, b: Project): number {
  return (
    chapterIds.indexOf(a.chapter) - chapterIds.indexOf(b.chapter) ||
    a.order - b.order ||
    a.slug.localeCompare(b.slug)
  );
}

/**
 * Every project on disk, drafts included, in desk order. A cover that points
 * at a missing file fails here, at build time, rather than as a broken image.
 */
export function loadProjects(root: string = contentRoot(), media: string = publicRoot()): Project[] {
  const dir = path.join(root, "projects");
  if (!existsSync(dir)) return [];

  const seen = new Map<string, string>();
  const projects: Project[] = [];

  for (const file of readdirSync(dir).sort()) {
    const match = /^(.+)\.ya?ml$/.exec(file);
    if (!match) continue;
    const slug = match[1]!;
    const previous = seen.get(slug);
    if (previous) throw new ContentError(`${file}: duplicates ${previous} — one file per project`);
    seen.set(slug, file);
    const project = parseProject(slug, readFileSync(path.join(dir, file), "utf8"), file);
    for (const src of mediaOf(project)) {
      if (!existsSync(path.join(media, src))) {
        throw new ContentError(`${file}: image ${src} does not exist in public/`);
      }
    }
    projects.push(project);
  }

  return projects.sort(compareProjects);
}

/** Projects of one chapter, in station order. */
export function projectsOf(projects: Project[], chapter: ChapterId): Project[] {
  return projects.filter((p) => p.chapter === chapter);
}

export function visibleProjects(projects: Project[], includeDrafts: boolean = showDrafts()): Project[] {
  return includeDrafts ? projects : projects.filter((p) => p.status === "published");
}

/**
 * The real number of projects per chapter, as the desk shows it. Only
 * published projects count: the number is a fact, not a promise.
 */
export function countByChapter(projects: Project[]): Record<ChapterId, number> {
  const counts = Object.fromEntries(chapterIds.map((id) => [id, 0])) as Record<ChapterId, number>;
  for (const project of projects) if (project.status === "published") counts[project.chapter] += 1;
  return counts;
}

export interface LocalizedProject {
  slug: string;
  chapter: ChapterId;
  status: Project["status"];
  title: string;
  summary: string;
  /** Language the title and summary are actually written in. */
  lang: Locale;
  body: string;
  /** Language the body is actually written in. */
  bodyLang: Locale;
  cover?: string;
  /** Written in `lang`, like the rest of the card. */
  coverAlt: string;
  year?: number;
  links: Project["links"];
  stack: string[];
  device?: string;
  /** Minutes. */
  duration?: number;
  /** Empty when neither language has one. */
  role: string;
  /** Language the role is actually written in. */
  roleLang: Locale;
  /** Parts named on the cover by the diagnostic scan; empty without. */
  scan: ScanMarker[];
  /** Language the scan's labels are actually written in. */
  scanLang: Locale;
}

/**
 * A project as a given locale should display it. A translation counts only
 * when it has both a title and a summary; otherwise the whole card falls back
 * to the default locale — never a mix of two languages in one station — and
 * `lang` says so, so the markup can carry the right `lang` attribute.
 */
export function localizeProject(project: Project, locale: Locale): LocalizedProject {
  const own = project.translations[locale];
  const fallback = project.translations[defaultLocale];
  const translated = Boolean(own?.title && own?.summary);
  const card = translated ? own : fallback;
  const ownBody = own?.body.trim() ? own.body : "";
  const ownRole = own?.role ?? "";
  const ownScan = own?.scan ?? [];

  return {
    slug: project.slug,
    chapter: project.chapter,
    status: project.status,
    title: card?.title || project.slug,
    summary: card?.summary ?? "",
    lang: translated ? locale : defaultLocale,
    body: ownBody || fallback?.body || "",
    bodyLang: ownBody ? locale : defaultLocale,
    cover: project.cover,
    coverAlt: card?.coverAlt || fallback?.coverAlt || "",
    year: project.year,
    links: project.links,
    stack: project.stack,
    device: project.device,
    duration: project.duration,
    role: ownRole || fallback?.role || "",
    roleLang: ownRole ? locale : defaultLocale,
    // A list as a whole, never a mix: the boxes of one language, with its labels.
    scan: ownScan.length > 0 ? ownScan : (fallback?.scan ?? []),
    scanLang: ownScan.length > 0 ? locale : defaultLocale,
  };
}
