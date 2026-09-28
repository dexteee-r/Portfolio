/**
 * The drawer, by hand: on a touch screen, a chapter pulled down from the top
 * of its page goes back to the desk. Pure logic, no DOM — ViewStage feeds it
 * touches and applies what it decides.
 *
 * The rules, in the order a gesture meets them:
 * - it only starts at the very top of the page (the caller checks the scroll):
 *   anywhere lower, pulling down is scrolling back up;
 * - nothing is decided before the finger has moved PULL_SLOP pixels — a tap
 *   stays a tap;
 * - then a mostly downward move is a pull; anything else (up, sideways) is
 *   left to the browser for the rest of the gesture;
 * - on release, the chapter closes if it was pulled a quarter of the screen,
 *   or flicked down; otherwise — or if the finger was going back up — it
 *   slides back into place.
 */

/** Movement before a gesture is read as a pull, a scroll or a tap. */
export const PULL_SLOP = 10;
/** Pulled this far down (a share of the screen's height), it closes on release. */
export const CLOSE_FRACTION = 0.25;
/** A shorter pull still closes when flicked down this fast (px/ms)… */
export const FLICK_VELOCITY = 0.6;
/** …as long as it went at least this far. */
export const FLICK_MIN_DISTANCE = 48;
/** Moving back up faster than this at release cancels, however far it went. */
const RETREAT_VELOCITY = -0.2;
/** The speed that counts is the finger's in the last moments of the gesture. */
const VELOCITY_WINDOW_MS = 100;

interface Sample {
  y: number;
  t: number;
}

export type Pull =
  | { phase: "pending"; x: number; y: number; samples: Sample[] }
  | { phase: "pulling"; x: number; y: number; offset: number; samples: Sample[] }
  | { phase: "ignored" };

export type Release = "close" | "cancel" | "none";

export function startPull(x: number, y: number, t: number): Pull {
  return { phase: "pending", x, y, samples: [{ y, t }] };
}

export function movePull(pull: Pull, x: number, y: number, t: number): Pull {
  if (pull.phase === "ignored") return pull;
  const samples = [...pull.samples, { y, t }].filter((s) => t - s.t <= VELOCITY_WINDOW_MS);
  const dx = x - pull.x;
  const dy = y - pull.y;

  if (pull.phase === "pending") {
    if (Math.hypot(dx, dy) < PULL_SLOP) return { ...pull, samples };
    if (dy <= 0 || Math.abs(dx) > dy) return { phase: "ignored" };
  }
  // Measured from where the pull was recognised: the sheet never jumps.
  return { phase: "pulling", x: pull.x, y: pull.y, offset: Math.max(0, dy - PULL_SLOP), samples };
}

/** The finger's vertical speed at `now`, in px/ms (positive = down). */
export function pullVelocity(pull: Pull, now: number): number {
  if (pull.phase === "ignored") return 0;
  const recent = pull.samples.filter((s) => now - s.t <= VELOCITY_WINDOW_MS);
  if (recent.length < 2) return 0;
  const first = recent[0]!;
  const last = recent[recent.length - 1]!;
  return last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0;
}

/** What letting go at `now` does, on a screen `height` pixels tall. */
export function releasePull(pull: Pull, height: number, now: number): Release {
  if (pull.phase !== "pulling") return "none";
  const velocity = pullVelocity(pull, now);
  if (velocity < RETREAT_VELOCITY) return "cancel";
  if (pull.offset >= height * CLOSE_FRACTION) return "close";
  if (pull.offset >= FLICK_MIN_DISTANCE && velocity >= FLICK_VELOCITY) return "close";
  return "cancel";
}
