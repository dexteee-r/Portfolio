import { z } from "zod";
import { defaultLocale, locales, plannedLocales, type Locale } from "@/i18n/config";
import { chapterIds, type ChapterId } from "./chapters";

export { SLUG_PATTERN } from "./slug";

/**
 * Station and page images live in public/media and are served through the
 * framework image pipeline (AVIF, then WebP). No raw JPEG enters the repository.
 */
export const COVER_PATTERN = /^\/media\/[a-z0-9][a-z0-9/_-]*\.(?:avif|webp|png)$/;

/** A station shows two or three lines. Past this, it is no longer a teaser. */
export const SUMMARY_MAX_LENGTH = 280;

/** The role is one line of a spec sheet, not a paragraph. */
export const ROLE_MAX_LENGTH = 80;
/** A stack is a handful of names; past this, it is a list of everything touched. */
export const STACK_MAX_ITEMS = 8;
export const STACK_ITEM_MAX_LENGTH = 24;
/** A device's commercial name fits on one line of a ticket. */
export const DEVICE_MAX_LENGTH = 40;
/** A repair counted in minutes; past 100 hours, it is a project, not an intervention. */
export const DURATION_MAX_MINUTES = 6000;

export const projectStatuses = ["draft", "published"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

/** Link labels are translated by the interface, not typed in each file. */
export const linkKinds = ["site", "repo", "video", "download"] as const;
export type LinkKind = (typeof linkKinds)[number];

export const localizedFieldsSchema = z
  .object({
    title: z.string().trim().default(""),
    summary: z.string().trim().max(SUMMARY_MAX_LENGTH).default(""),
    /** Long form for the project page, in Markdown. */
    body: z.string().default(""),
    /** Describes the cover for people who cannot see it. */
    coverAlt: z.string().trim().default(""),
    /** What was done on the project, in a few words — the spec sheet's "Role". */
    role: z.string().trim().max(ROLE_MAX_LENGTH).default(""),
  })
  .strict();
export type LocalizedFields = z.infer<typeof localizedFieldsSchema>;

export const sharedFieldsSchema = z
  .object({
    chapter: z.enum(chapterIds),
    status: z.enum(projectStatuses).default("draft"),
    /** Position within the chapter, ascending. */
    order: z.number().int().min(0).default(100),
    year: z.number().int().min(2000).max(2100).optional(),
    /** `/media/projects/<slug>/cover.webp` — the station's strong image. */
    cover: z
      .string()
      .regex(COVER_PATTERN, "must be /media/….avif, .webp or .png (lowercase, no JPEG)")
      .optional(),
    links: z
      .array(z.object({ kind: z.enum(linkKinds), url: z.url({ protocol: /^https?$/ }) }).strict())
      .default([]),
    /** Technologies, tools or gear, by their own names: never translated. */
    stack: z
      .array(z.string().trim().min(1).max(STACK_ITEM_MAX_LENGTH))
      .max(STACK_MAX_ITEMS)
      .refine((items) => new Set(items.map((item) => item.toLowerCase())).size === items.length, "lists a name twice")
      .default([]),
    /** The repaired device, by its commercial name: never translated. */
    device: z.string().trim().min(1).max(DEVICE_MAX_LENGTH).optional(),
    /** How long the intervention took, in minutes. */
    duration: z.number().int().min(1).max(DURATION_MAX_MINUTES).optional(),
  })
  .strict();

export const SHARED_KEYS = Object.keys(sharedFieldsSchema.shape) as Array<
  keyof typeof sharedFieldsSchema.shape
>;
export const LOCALIZED_KEYS = Object.keys(localizedFieldsSchema.shape) as Array<
  keyof typeof localizedFieldsSchema.shape
>;

/**
 * Top-level keys a project file may carry: shared fields, one block per
 * locale (planned ones included, so content can be prepared ahead), and the
 * `lang` list Sveltia CMS maintains on its own.
 */
export const ALLOWED_TOP_LEVEL_KEYS = new Set<string>([
  ...SHARED_KEYS,
  ...locales,
  ...plannedLocales,
  "lang",
]);

export interface Project {
  slug: string;
  chapter: ChapterId;
  status: ProjectStatus;
  order: number;
  year?: number;
  cover?: string;
  links: Array<{ kind: LinkKind; url: string }>;
  stack: string[];
  device?: string;
  duration?: number;
  translations: Partial<Record<Locale, LocalizedFields>>;
}

/** A published project must at least read fully in the default locale. */
export function publicationProblems(project: Project): string[] {
  if (project.status !== "published") return [];
  const own = project.translations[defaultLocale];
  const problems: string[] = [];
  if (!own?.title) problems.push(`published but has no ${defaultLocale}.title`);
  if (!own?.summary) problems.push(`published but has no ${defaultLocale}.summary`);
  if (project.cover && !own?.coverAlt) {
    problems.push(`published with a cover but no ${defaultLocale}.coverAlt`);
  }
  return problems;
}
