/**
 * The repair world's opening reel: one repair after another through the
 * scanner. Pure timing and geometry, shared by the reel (components/repair)
 * and its WebGL X-ray, so the line, the boxes and the X-ray never drift apart.
 */

/** A repair every 2.5 seconds. */
export const CYCLE_MS = 2500;
/** The photo fades in, then the line sweeps down it. */
export const SWEEP_START_MS = 250;
export const SWEEP_MS = 1200;
/** Once the line is past, the X-ray fades back to the photo. */
export const XRAY_FADE_MS = 450;
/** Every photo is shown in the same frame, portrait 3:4 — most repairs are phones. */
export const FRAME_ASPECT = 3 / 4;

export interface ReelPhase {
  /** The sweeping line, 0 at the top, 1 at the bottom; -1 when there is none. */
  line: number;
  /** How much of the swept X-ray still shows, 1 → 0. */
  keep: number;
}

/** Where the scan stands, `ms` into a repair's cycle. */
export function phaseAt(ms: number): ReelPhase {
  const swept = ms - SWEEP_START_MS;
  if (swept < 0) return { line: -1, keep: 0 };
  if (swept <= SWEEP_MS) return { line: swept / SWEEP_MS, keep: 1 };
  const fading = swept - SWEEP_MS;
  if (fading <= XRAY_FADE_MS) return { line: 1, keep: 1 - fading / XRAY_FADE_MS };
  return { line: -1, keep: 0 };
}

/** Whether a box at `top` (0–1 of the frame) has been reached by the line, `ms` into the cycle. */
export function lockedAt(ms: number, top: number): boolean {
  return ms - SWEEP_START_MS >= Math.max(0, top) * SWEEP_MS;
}

export interface Crop {
  /** Share of the image's width and height that the frame shows. */
  scaleX: number;
  scaleY: number;
  /** Where that share starts, 0–1 of the image. */
  offsetX: number;
  offsetY: number;
}

/** What a frame of `frameAspect` (width / height) shows of an image covering it, centred. */
export function coverCrop(width: number, height: number, frameAspect: number = FRAME_ASPECT): Crop {
  const image = width / height;
  if (image > frameAspect) {
    const scaleX = frameAspect / image;
    return { scaleX, scaleY: 1, offsetX: (1 - scaleX) / 2, offsetY: 0 };
  }
  const scaleY = image / frameAspect;
  return { scaleX: 1, scaleY, offsetX: 0, offsetY: (1 - scaleY) / 2 };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A box drawn in percent of the whole photo, moved into the frame that crops
 * it — clipped to what shows; null when none of it does.
 */
export function boxInFrame(box: Box, crop: Crop): Box | null {
  const left = ((box.x / 100 - crop.offsetX) / crop.scaleX) * 100;
  const top = ((box.y / 100 - crop.offsetY) / crop.scaleY) * 100;
  const right = left + (box.w / 100 / crop.scaleX) * 100;
  const bottom = top + (box.h / 100 / crop.scaleY) * 100;
  const x = Math.max(0, left);
  const y = Math.max(0, top);
  const w = Math.min(100, right) - x;
  const h = Math.min(100, bottom) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}
