/**
 * ELMZN — desk → chapter transition.
 *
 * Swapping the technique later is a ONE-LINE change: edit DESKTOP_TECHNIQUE
 * below. Nothing else in the app knows which technique is running.
 *
 * Shipping with 'drawer' because it animates transform and opacity only —
 * the two properties that are hardware accelerated everywhere — and because
 * it maps to a swipe on touch devices. 'disc' and 'iris' are implemented and
 * ready; see the notes on each before switching.
 */

export type Technique = "drawer" | "disc" | "iris";

/** Change this line to swap the desktop transition. */
const DESKTOP_TECHNIQUE: Technique = "drawer";

/**
 * Touch and narrow viewports always get 'drawer'.
 * 'iris' animates clip-path, which is not reliably compositor-accelerated on
 * mobile browsers — it repaints the whole layer each frame on many of them.
 * 'disc' is cheap but needs a large starting radius on tall screens, or its
 * edge turns polygonal at the scale factors a 9:16 viewport demands.
 */
const MOBILE_TECHNIQUE: Technique = "drawer";
const MOBILE_QUERY = "(max-width: 768px), (pointer: coarse)";

const DURATION: Record<Technique, number> = {
  drawer: 560,
  disc: 700,
  iris: 640,
};

const EASE_STANDARD = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IRIS = "cubic-bezier(0.5, 0, 0.3, 1)";

export interface TransitionContext {
  /** Clipping container. Must be `position: relative; overflow: hidden`. */
  stage: HTMLElement;
  /** View being left behind. */
  leaving: HTMLElement;
  /** View coming in. Must already be laid out and painted. */
  arriving: HTMLElement;
  /** Clicked chapter mark. Required by point-based techniques; ignored otherwise. */
  origin?: HTMLElement | null;
  /** Ground colour of the destination view. */
  color: string;
  /** "in" = desk → chapter, "out" = chapter → desk. */
  direction: "in" | "out";
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function pickTechnique(): Technique {
  if (typeof window === "undefined") return DESKTOP_TECHNIQUE;
  return window.matchMedia(MOBILE_QUERY).matches
    ? MOBILE_TECHNIQUE
    : DESKTOP_TECHNIQUE;
}

interface Point {
  cx: number;
  cy: number;
  farthestCorner: number;
}

function measure(stage: HTMLElement, origin?: HTMLElement | null): Point {
  const box = stage.getBoundingClientRect();
  const rect = origin
    ? origin.getBoundingClientRect()
    : ({ left: box.left + box.width / 2, top: box.top + box.height / 2, width: 0, height: 0 } as DOMRect);

  const cx = rect.left + rect.width / 2 - box.left;
  const cy = rect.top + rect.height / 2 - box.top;

  const farthestCorner = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(box.width - cx, cy),
    Math.hypot(cx, box.height - cy),
    Math.hypot(box.width - cx, box.height - cy)
  );

  return { cx, cy, farthestCorner };
}

/** How far the desk recedes while a chapter covers it. */
const DESK_RECEDE = 0.965;

/**
 * The chapter is always the moving sheet and the desk always the one that
 * recedes: "out" plays "in" backwards — the chapter slides back down and the
 * desk comes forward again. The caller keeps the chapter view stacked above
 * the desk in both directions.
 */
async function drawer(ctx: TransitionContext): Promise<void> {
  const options: KeyframeAnimationOptions = {
    duration: DURATION.drawer,
    easing: EASE_STANDARD,
    fill: "forwards",
  };
  const covered = { transform: "translateY(0)" };
  const lowered = { transform: "translateY(100%)" };
  const upright = { transform: "scale(1)" };
  const receded = { transform: `scale(${DESK_RECEDE})` };

  if (ctx.direction === "in") {
    ctx.leaving.animate([upright, receded], options);
    await ctx.arriving.animate([lowered, covered], options).finished;
  } else {
    ctx.arriving.animate([receded, upright], options);
    await ctx.leaving.animate([covered, lowered], options).finished;
  }
}

async function disc(ctx: TransitionContext): Promise<void> {
  const ms = DURATION.disc;
  const { cx, cy, farthestCorner } = measure(ctx.stage, ctx.origin);

  // A 40px base keeps the end-state scale factor low enough that the edge
  // stays smooth on tall viewports.
  const base = 40;
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "absolute",
    left: `${cx}px`,
    top: `${cy}px`,
    width: `${base}px`,
    height: `${base}px`,
    marginLeft: `${-base / 2}px`,
    marginTop: `${-base / 2}px`,
    borderRadius: "50%",
    background: ctx.color,
    pointerEvents: "none",
    zIndex: "50",
  } satisfies Partial<CSSStyleDeclaration>);

  ctx.stage.appendChild(overlay);

  const scale = ((farthestCorner / (base / 2)) * 1.06).toFixed(3);

  try {
    await overlay.animate(
      [{ transform: "scale(0)" }, { transform: `scale(${scale})` }],
      { duration: ms, easing: EASE_STANDARD, fill: "forwards" }
    ).finished;
  } finally {
    overlay.remove();
  }
}

async function iris(ctx: TransitionContext): Promise<void> {
  const ms = DURATION.iris;
  const { cx, cy, farthestCorner } = measure(ctx.stage, ctx.origin);
  const open = `circle(${farthestCorner * 1.05}px at ${cx}px ${cy}px)`;
  const shut = `circle(0px at ${cx}px ${cy}px)`;

  await ctx.leaving.animate([{ clipPath: open }, { clipPath: shut }], {
    duration: ms,
    easing: EASE_IRIS,
    fill: "forwards",
  }).finished;
}

/**
 * Exposed so each technique can be tested on its own, including the two not
 * yet shipped. Application code calls `runTransition()` and nothing else.
 */
export const techniques: Readonly<Record<Technique, (ctx: TransitionContext) => Promise<void>>> = {
  drawer,
  disc,
  iris,
};

/**
 * Runs the transition and resolves once it has finished. Callers swap the
 * views and clear inline styles afterwards — this module never mutates
 * application state.
 *
 * Under prefers-reduced-motion it resolves immediately without animating.
 */
export async function runTransition(ctx: TransitionContext): Promise<void> {
  if (prefersReducedMotion()) return;
  await techniques[pickTechnique()](ctx);
}

export function transitionDuration(): number {
  return prefersReducedMotion() ? 0 : DURATION[pickTechnique()];
}

/* -----------------------------------------------------------------------------
   The quiet transition — station ↔ project page, inside one chapter.
   A classic, careful page change: the new page settles in. A rare effect stays
   an effect, so this one is deliberately small. Values mirror tokens.css
   (--duration-base, --ease-standard); a unit test keeps them in sync.
   ----------------------------------------------------------------------------- */

const PAGE_DURATION = 260;
const EASE_PAGE = "cubic-bezier(0.2, 0, 0, 1)";

export function pageTransitionDuration(): number {
  return prefersReducedMotion() ? 0 : PAGE_DURATION;
}

/** Fades the arriving page in from slightly below. Instant under reduced motion. */
export async function runPageTransition(arriving: HTMLElement): Promise<void> {
  if (prefersReducedMotion()) return;
  await arriving.animate(
    [
      { opacity: 0, transform: "translateY(12px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: PAGE_DURATION, easing: EASE_PAGE },
  ).finished;
}
