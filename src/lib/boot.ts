import { chapterIds } from "@/content/chapters";
import { locales } from "@/i18n/config";

/**
 * The boot sequence plays the site's origin story instead of telling it:
 * every project started as a folder bearing its name — and the desk itself
 * is born from that first folder.
 *
 *   1. an empty folder traces itself;
 *   2. its label takes four real project names, starting while it traces;
 *   3. "Everything starts with an empty folder." appears, and stays a moment;
 *   4. the grey folder becomes the four coloured ones, which fly to their
 *      exact places on the desk while the ground clears.
 *
 * Paced for reading rather than to the brief's first 1.95 s: slower names, a
 * held sentence and a real ending (decided 2026-09-25). It still plays once,
 * on the first load of the desk, never under reduced motion, never without
 * JavaScript, and any key, click, touch or scroll skips it.
 *
 * Steps 1–3 are CSS, running from the first paint. Step 4 needs the real
 * positions of the four marks, so the inline runtime below plays it with the
 * Web Animations API, started by the end of a CSS "hold" animation — the same
 * clock as the rest. Nothing waits for React.
 */

/** Real project folders, in the order the label takes them. */
export const BOOT_NAMES = ["mytgc", "schooltrack", "omniroute", "dexteeer-labo"] as const;

/** Every time in milliseconds from the first paint. */
export const bootTimeline = {
  trace: { at: 0, duration: 1100 },
  names: { at: 300, step: 350 },
  phrase: { at: 1700, duration: 500 },
  /** The sentence has been read: the folder, its label and the sentence fade. */
  split: { at: 2900, duration: 300 },
  /** The four folders fly out, one after the other. */
  fly: { at: 2950, duration: 850, stagger: 50 },
  /** The ground clears, revealing the desk under the flying folders. */
  ground: { at: 3050, duration: 600 },
} as const;

const { fly } = bootTimeline;
export const BOOT_TOTAL = fly.at + (chapterIds.length - 1) * fly.stagger + fly.duration;

/**
 * If the animations never run — a tab opened in the background does not
 * advance them — the overlay goes anyway after this long.
 */
export const BOOT_FAILSAFE = BOOT_TOTAL + 2000;

export const BOOT_STORAGE_KEY = "elmzn.boot";
export const BOOT_ATTRIBUTE = "data-boot";
/** CSS animation whose end starts the finale: the shared clock. */
export const BOOT_HOLD_ANIMATION = "boot-hold";

export interface NameWindow {
  name: string;
  at: number;
  until: number;
}

/** When each name is on the label. The last one stays until the folder splits. */
export function nameWindows(): NameWindow[] {
  const { at, step } = bootTimeline.names;
  return BOOT_NAMES.map((name, index) => ({
    name,
    at: at + index * step,
    until: index === BOOT_NAMES.length - 1 ? bootTimeline.split.at : at + (index + 1) * step,
  }));
}

/** The desk's own URLs, one per published locale: `/fr`, `/en`. */
export const DESK_PATH = new RegExp(`^/(?:${locales.join("|")})/?$`);

export interface BootConfig {
  desk: string;
  reducedMotionQuery: string;
  storageKey: string;
  attribute: string;
  holdAnimation: string;
  failsafe: number;
  /** Times relative to the split, which is when the finale starts. */
  centerFade: number;
  flyDelay: number;
  flyDuration: number;
  flyStagger: number;
  groundDelay: number;
  groundDuration: number;
  easeExit: string;
  /** The flight: a gentle lift-off the eye can follow, then a soft landing. */
  easeFlight: string;
}

export function bootConfig(): BootConfig {
  const { split, fly, ground } = bootTimeline;
  return {
    desk: DESK_PATH.source,
    reducedMotionQuery: "(prefers-reduced-motion: reduce)",
    storageKey: BOOT_STORAGE_KEY,
    attribute: BOOT_ATTRIBUTE,
    holdAnimation: BOOT_HOLD_ANIMATION,
    failsafe: BOOT_FAILSAFE,
    centerFade: split.duration,
    flyDelay: fly.at - split.at,
    flyDuration: fly.duration,
    flyStagger: fly.stagger,
    groundDelay: ground.at - split.at,
    groundDuration: ground.duration,
    // Same values as --ease-exit and --ease-standard in tokens.css; a test keeps them in sync.
    // Not --ease-flood: its instant burst would snap the folders away before the eye can follow.
    easeExit: "cubic-bezier(0.4, 0, 1, 1)",
    easeFlight: "cubic-bezier(0.2, 0, 0, 1)",
  };
}

/**
 * The boot runtime. Inlined into the page as source (`bootScript`), so it must
 * stay self-contained: no imports, no outer variables — only its argument and
 * browser globals.
 */
export function bootRuntime(config: BootConfig): void {
  const root = document.documentElement;
  try {
    if (!new RegExp(config.desk).test(location.pathname)) return;
    if (window.matchMedia(config.reducedMotionQuery).matches) return;
    if (localStorage.getItem(config.storageKey)) return;
    localStorage.setItem(config.storageKey, "seen");
  } catch {
    return; // no storage: stay silent rather than replay on every visit
  }

  const skips = ["keydown", "pointerdown", "wheel", "touchstart"];
  const running: Animation[] = [];
  let ended = false;

  function end() {
    if (ended) return;
    ended = true;
    for (const animation of running) animation.cancel();
    root.removeAttribute(config.attribute);
    for (const type of skips) window.removeEventListener(type, end, true);
    window.removeEventListener("animationend", onAnimationEnd, true);
    clearTimeout(failsafe);
  }

  function play(element: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    const animation = element.animate(keyframes, { fill: "forwards", ...options });
    running.push(animation);
    return animation;
  }

  function finale() {
    const overlay = document.querySelector("[data-boot-overlay]");
    const source = overlay?.querySelector(".boot-folder");
    const center = overlay?.querySelector(".boot-center");
    const ground = overlay?.querySelector(".boot-ground");
    if (!overlay || !source || !center || !ground || typeof overlay.animate !== "function") {
      end();
      return;
    }

    const from = source.getBoundingClientRect();
    const flights: Promise<Animation>[] = [];

    play(center, [{ opacity: 1 }, { opacity: 0 }], { duration: config.centerFade, easing: config.easeExit });
    play(ground, [{ opacity: 1 }, { opacity: 0 }], {
      delay: config.groundDelay,
      duration: config.groundDuration,
      easing: config.easeExit,
    });

    overlay.querySelectorAll<HTMLElement>("[data-boot-fly]").forEach((flyer, index) => {
      const chapter = flyer.getAttribute("data-boot-fly");
      const target = document
        .querySelector(`[data-chapter-mark="${chapter}"] svg`)
        ?.getBoundingClientRect();
      if (!target || from.width === 0) return;

      // Start exactly on the grey folder…
      flyer.style.left = `${from.left}px`;
      flyer.style.top = `${from.top}px`;
      flyer.style.width = `${from.width}px`;
      // …and land exactly on the mark.
      const dx = target.left + target.width / 2 - (from.left + from.width / 2);
      const dy = target.top + target.height / 2 - (from.top + from.height / 2);
      const scale = target.width / from.width;

      play(flyer, [{ opacity: 0 }, { opacity: 1 }], { duration: config.centerFade, easing: config.easeFlight });
      const flight = play(
        flyer,
        [{ transform: "translate(0px, 0px) scale(1)" }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})` }],
        { delay: config.flyDelay + index * config.flyStagger, duration: config.flyDuration, easing: config.easeFlight },
      );
      flights.push(flight.finished);
    });

    if (flights.length === 0) {
      // Nothing to land on: a plain fade to the desk.
      play(overlay, [{ opacity: 1 }, { opacity: 0 }], { duration: config.groundDuration, easing: config.easeExit })
        .finished.then(end, end);
      return;
    }
    Promise.all(flights).then(end, end);
  }

  function onAnimationEnd(event: AnimationEvent) {
    if (event.animationName === config.holdAnimation && !ended) finale();
  }

  root.setAttribute(config.attribute, "play");
  for (const type of skips) window.addEventListener(type, end, { capture: true, passive: true });
  window.addEventListener("animationend", onAnimationEnd, true);
  const failsafe = setTimeout(end, config.failsafe);
}

/**
 * The runtime as an inline script. It runs synchronously while the HTML is
 * parsed, before the first paint: the first element of <body>.
 */
export function bootScript(): string {
  return `(${bootRuntime.toString()})(${JSON.stringify(bootConfig())});`;
}
