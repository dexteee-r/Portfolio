import { chapterFromSlug, type ChapterId } from "@/content/chapters";
import { pageFromSlug, type PageId } from "@/content/pages";
import { SLUG_PATTERN } from "@/content/slug";
import { isLocale, type Locale } from "@/i18n/config";

/**
 * What a rendered view is: the light frame (desk, its pages, 404), a chapter,
 * or a project page — the last two in their chapter's grade.
 */
export type ViewKind = "frame" | "chapter" | "project";
export type Direction = "in" | "out";

export type PathTarget =
  | { kind: "desk"; locale: Locale }
  | { kind: "page"; locale: Locale; page: PageId }
  | { kind: "chapter"; locale: Locale; chapter: ChapterId }
  | { kind: "project"; locale: Locale; chapter: ChapterId; project: string }
  | { kind: "other" };

/** Classifies a pathname by the level of the site it points at. */
export function classifyPath(pathname: string): PathTarget {
  const segments = pathname.split("/").filter(Boolean);
  const [locale, slug, project, ...rest] = segments;
  if (locale === undefined || !isLocale(locale)) return { kind: "other" };
  if (slug === undefined) return { kind: "desk", locale };

  const page = pageFromSlug(locale, slug);
  if (page) return project === undefined ? { kind: "page", locale, page } : { kind: "other" };

  const chapter = chapterFromSlug(locale, slug);
  if (!chapter || rest.length > 0) return { kind: "other" };
  if (project === undefined) return { kind: "chapter", locale, chapter };
  return SLUG_PATTERN.test(project) ? { kind: "project", locale, chapter, project } : { kind: "other" };
}

/**
 * The drawer runs between the frame and a chapter's grade, both ways: into a
 * chapter or project from the frame, and back out of one onto the frame —
 * the desk or one of its pages. Everything else — a language switch, an
 * anchor, one chapter to another, a station to its project, the desk to its
 * pages — is not the signature transition, because a rare effect stays an
 * effect. (Leaving a chapter for a frame page still needs it: a cut from the
 * dark grade to the light frame is a flash.)
 */
export function transitionFor(current: ViewKind | null, targetPath: string): Direction | null {
  const target = classifyPath(targetPath).kind;
  const graded = target === "chapter" || target === "project";
  const frame = target === "desk" || target === "page";
  if (current === "frame" && graded) return "in";
  if ((current === "chapter" || current === "project") && frame) return "out";
  return null;
}

/**
 * The quiet page transition: moving inside one chapter, between its page and
 * its projects, in the same language. Same grade on both sides, so a short
 * fade is enough — and no flash is possible.
 */
export function isQuietMove(fromPath: string, toPath: string): boolean {
  if (fromPath === toPath) return false;
  const from = classifyPath(fromPath);
  const to = classifyPath(toPath);
  if (from.kind !== "chapter" && from.kind !== "project") return false;
  if (to.kind !== "chapter" && to.kind !== "project") return false;
  return from.locale === to.locale && from.chapter === to.chapter;
}

export function isViewKind(value: string | undefined): value is ViewKind {
  return value === "frame" || value === "chapter" || value === "project";
}

/**
 * The internal link a click is about to follow, or null when the browser (or
 * the visitor) should keep control: modified clicks, new tabs, downloads,
 * other origins and clicks already handled elsewhere.
 */
export function followedLink(event: MouseEvent, origin: string): URL | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

  const target = event.target;
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;

  const url = new URL(anchor.href, origin);
  return url.origin === origin ? url : null;
}

/** Escape must never be stolen from someone typing. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.getAttribute("contenteditable") === "true" ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}
