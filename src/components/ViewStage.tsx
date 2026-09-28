"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { isChapterId } from "@/content/chapters";
import { SLUG_PATTERN } from "@/content/slug";
import { chapterPath, homePath } from "@/i18n/paths";
import {
  pageTransitionDuration,
  runPageTransition,
  runTransition,
  transitionDuration,
} from "@/lib/transitions";
import {
  classifyPath,
  followedLink,
  isEditableTarget,
  isQuietMove,
  isViewKind,
  transitionFor,
  type Direction,
  type ViewKind,
} from "@/lib/view-routing";

/** Longest a navigation may take before the page is handed back untouched. */
export const NAVIGATION_TIMEOUT_MS = 8000;

/**
 * Grace beyond an animation's own duration before it is forced to its end.
 * A hidden tab does not advance animations at all: without this, a click
 * followed by a tab switch would leave the frozen copy on screen.
 */
export const SETTLE_MARGIN_MS = 1000;

/** The chapter is always the sheet on top, in both directions. */
const Z_BELOW = "10";
const Z_ABOVE = "30";

interface Pending {
  direction: Direction;
  fromPath: string;
  /** Chapter being left, so focus can return to its folder on the desk. */
  fromChapter: string | null;
  /** Frozen copy of the view being left; null when motion is reduced. */
  layer: HTMLElement | null;
  origin: HTMLElement | null;
  timer: ReturnType<typeof setTimeout>;
}

function currentView(stage: HTMLElement | null): HTMLElement | null {
  return stage?.querySelector<HTMLElement>("[data-stage-views] [data-view]") ?? null;
}

function viewKind(view: HTMLElement | null): ViewKind | null {
  const kind = view?.dataset.view;
  return isViewKind(kind) ? kind : null;
}

/**
 * A frozen copy of the view being left, pinned to the viewport exactly where
 * it was on screen. It stays put while React swaps the real view underneath.
 */
function freeze(view: HTMLElement, onTop: boolean): HTMLElement {
  const copy = view.cloneNode(true) as HTMLElement;
  copy.removeAttribute("data-view");
  for (const el of [copy, ...copy.querySelectorAll("[id]")]) el.removeAttribute("id");
  copy.style.marginTop = `${-window.scrollY}px`;

  const layer = document.createElement("div");
  layer.setAttribute("data-stage-leaving", "");
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("inert", "");
  Object.assign(layer.style, {
    position: "fixed",
    inset: "0",
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: onTop ? Z_ABOVE : Z_BELOW,
  });
  layer.append(copy);
  return layer;
}

const PINNED = ["position", "inset", "overflow", "z-index", "transform"] as const;

/** Holds the arriving view to the viewport while the drawer runs. */
function pin(view: HTMLElement, direction: Direction) {
  Object.assign(view.style, {
    position: "fixed",
    inset: "0",
    overflow: "hidden",
    zIndex: direction === "in" ? Z_ABOVE : Z_BELOW,
    // First frame before the animation takes over: no flash of the end state.
    transform: direction === "in" ? "translateY(100%)" : "",
  });
}

function finishAnimations(...elements: HTMLElement[]) {
  for (const element of elements) {
    for (const animation of element.getAnimations?.({ subtree: true }) ?? []) {
      try {
        animation.finish();
      } catch {
        // An animation that cannot finish (infinite, already cancelled) is left alone.
      }
    }
  }
}

function release(view: HTMLElement) {
  for (const animation of view.getAnimations?.() ?? []) animation.cancel();
  for (const property of PINNED) view.style.removeProperty(property);
}

/** Title of a chapter or project page: where focus lands on arrival. */
function focusTitle(view: HTMLElement) {
  view.querySelector<HTMLElement>("[data-view-title]")?.focus({ preventScroll: true });
}

/** Back on the desk: focus returns to the folder of the chapter just left. False when there is none. */
function focusFolder(view: HTMLElement, chapter: string | null): boolean {
  if (!chapter || !isChapterId(chapter)) return false;
  const folder = view.querySelector<HTMLElement>(`[data-chapter-mark="${chapter}"]`);
  folder?.focus({ preventScroll: true });
  return folder !== null;
}

/** Back in a chapter from one of its projects: bring that station back into view. */
function focusStation(view: HTMLElement, project: string) {
  if (!SLUG_PATTERN.test(project)) return;
  const station = view.querySelector<HTMLElement>(`[data-station="${project}"]`);
  if (!station) return;
  station.scrollIntoView({ block: "center" });
  station.querySelector<HTMLElement>("a[href]")?.focus({ preventScroll: true });
}

/**
 * Hosts every view and runs the site's transitions:
 *
 * - the drawer, the one signature transition, between the desk and a chapter;
 * - a quiet fade inside a chapter, between its page and its projects.
 *
 * Links stay ordinary links — clicks are read on the way down (capture
 * phase), so no component needs to know a transition exists and the site
 * works identically without JavaScript. Also owns focus across views and the
 * Escape key, which climbs one level: project → chapter → desk, and from a
 * page of the frame (the legal notice) back to the desk.
 */
export function ViewStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const pending = useRef<Pending | null>(null);
  /** True from the click until the drawer has settled: one drawer at a time. */
  const busy = useRef(false);
  const router = useRouter();
  const routerRef = useRef(router);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const begin = useRef((href: string, direction: Direction, origin: HTMLElement | null) => {
    const stage = stageRef.current;
    const leaving = currentView(stage);
    if (!stage || !leaving) {
      routerRef.current.push(href);
      return;
    }
    busy.current = true;

    const layer = transitionDuration() > 0 ? freeze(leaving, direction === "out") : null;
    if (layer) stage.append(layer);

    const abandon = () => {
      layer?.remove();
      pending.current = null;
      busy.current = false;
    };

    pending.current = {
      direction,
      fromPath: pathnameRef.current,
      fromChapter: leaving.dataset.chapter ?? null,
      layer,
      origin,
      timer: setTimeout(abandon, NAVIGATION_TIMEOUT_MS),
    };
    routerRef.current.push(href, { scroll: false });
  });

  // Links: read on the way down, before next/link acts on the click.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function onClick(event: MouseEvent) {
      const url = followedLink(event, window.location.origin);
      if (!url) return;
      if (busy.current) {
        event.preventDefault(); // one drawer at a time
        return;
      }
      const direction = transitionFor(viewKind(currentView(stage)), url.pathname);
      if (!direction) return;
      event.preventDefault();
      const anchor = (event.target as Element).closest("a");
      begin.current(url.pathname + url.search + url.hash, direction, anchor);
    }

    stage.addEventListener("click", onClick, { capture: true });
    return () => stage.removeEventListener("click", onClick, { capture: true });
  }, []);

  // Escape climbs one level: a project closes onto its chapter, a chapter (or
  // a page of the frame) onto the desk.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || busy.current) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;

      const kind = viewKind(currentView(stageRef.current));
      const here = classifyPath(pathnameRef.current);
      if (kind === "chapter" && here.kind === "chapter") {
        event.preventDefault();
        begin.current(homePath(here.locale), "out", null);
      } else if (kind === "project" && here.kind === "project") {
        event.preventDefault();
        routerRef.current.push(chapterPath(here.locale, here.chapter));
      } else if (kind === "frame" && here.kind === "page") {
        event.preventDefault();
        routerRef.current.push(homePath(here.locale));
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // A new view is in the DOM: animate it before the browser paints it.
  useLayoutEffect(() => {
    const previous = pathnameRef.current;
    pathnameRef.current = pathname;
    if (previous === pathname) return;

    const stage = stageRef.current;
    const arriving = currentView(stage);
    const job = pending.current;

    if (!job) {
      if (!stage || !arriving) return;
      if (isQuietMove(previous, pathname)) settleQuietly(arriving, previous);
      // A frame page reached from the frame: same ground, no motion, but focus
      // moves to its title so a keyboard user starts reading there.
      else if (classifyPath(pathname).kind === "page") focusTitle(arriving);
      return;
    }

    clearTimeout(job.timer);
    pending.current = null;

    if (!stage || !arriving) {
      job.layer?.remove();
      busy.current = false;
      return;
    }

    window.scrollTo(0, 0);

    const land = () => {
      busy.current = false;
      // Out onto the desk: back to the folder left. Out onto a frame page: its title.
      if (job.direction === "in" || !focusFolder(arriving, job.fromChapter)) focusTitle(arriving);
    };

    if (!job.layer) {
      land();
      return;
    }

    const layer = job.layer;
    pin(arriving, job.direction);
    const watchdog = setTimeout(
      () => finishAnimations(layer, arriving),
      transitionDuration() + SETTLE_MARGIN_MS,
    );
    runTransition({
      stage,
      leaving: layer,
      arriving,
      origin: job.origin,
      color: getComputedStyle(arriving).backgroundColor,
      direction: job.direction,
    })
      .catch(() => {
        // An interrupted animation still ends in a clean, usable page.
      })
      .finally(() => {
        clearTimeout(watchdog);
        layer.remove();
        release(arriving);
        land();
      });
  }, [pathname]);

  // Leaving the page mid-drawer must not leave a frozen copy behind.
  useEffect(
    () => () => {
      if (pending.current) {
        clearTimeout(pending.current.timer);
        pending.current.layer?.remove();
      }
    },
    [],
  );

  return (
    <div ref={stageRef} data-stage="" className="relative overflow-clip">
      <div data-stage-views="">{children}</div>
    </div>
  );
}

/**
 * Inside one chapter: the new page settles in, and focus follows — onto the
 * project's title, or back onto the station the visitor came from.
 */
function settleQuietly(arriving: HTMLElement, previousPath: string) {
  const from = classifyPath(previousPath);
  if (viewKind(arriving) === "chapter" && from.kind === "project") focusStation(arriving, from.project);
  else focusTitle(arriving);

  const watchdog = setTimeout(() => finishAnimations(arriving), pageTransitionDuration() + SETTLE_MARGIN_MS);
  runPageTransition(arriving)
    .catch(() => {
      // Interrupted by the next navigation: nothing to restore.
    })
    .finally(() => clearTimeout(watchdog));
}
