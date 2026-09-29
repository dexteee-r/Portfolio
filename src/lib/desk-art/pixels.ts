import { BELGIUM, globeRotation, isLand, projectDot, unprojectPoint } from "./globe";
import { ditherInk } from "./raster";

/**
 * A tiny software renderer: the desk's globe is drawn into plain arrays —
 * greys (0 ink – 1 paper), then an ink mask (1 ink, 0 paper) — never with a
 * colour. The component paints the mask in the frame's ink, read from the page.
 */

/** The globe fills this share of the picture's width. */
export const GLOBE_RADIUS = 0.42;

function setInk(ink: Uint8Array, size: number, x: number, y: number, value = 1) {
  if (x >= 0 && x < size && y >= 0 && y < size) ink[y * size + x] = value;
}

/** Light from the top left, in front — a studio light on a chrome ball. */
const LIGHT = (() => {
  const [x, y, z] = [-0.5, 0.55, 0.67];
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length] as const;
})();

/**
 * The lit globe in greys: a sphere shaded by one light, the continents dense,
 * the sea a sparse screen darkening into the shadow side with a small, hard
 * highlight — the chrome skull's look, on the Earth.
 */
export function shadeGlobe(size: number, seconds: number): Float32Array {
  const luma = new Float32Array(size * size).fill(1);
  const radius = size * GLOBE_RADIUS;
  const centre = size / 2;
  const rotation = globeRotation(seconds);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const x = (px + 0.5 - centre) / radius;
      const y = (centre - (py + 0.5)) / radius;
      const r2 = x * x + y * y;
      if (r2 > 1) continue;
      const z = Math.sqrt(1 - r2);
      const lit = Math.max(0, x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]);
      const [lat, lon] = unprojectPoint({ x, y, z }, rotation);
      const edge = 0.85 + 0.15 * z;
      if (isLand(lat, lon)) {
        // Land: dense ink, lighter where the light falls — the continents lead.
        luma[py * size + px] = (0.06 + 0.4 * lit) * edge;
      } else {
        // Sea: the mirror of the light, seen from the front, is the highlight.
        const reflected = 2 * lit * z - LIGHT[2];
        const shine = Math.max(0, reflected) ** 48;
        luma[py * size + px] = Math.min(1, (0.6 + 0.38 * lit) * edge + 0.5 * shine);
      }
    }
  }
  return luma;
}

/**
 * Belgium, when it faces the viewer: a square of paper ringed in ink —
 * readable on land, sea or shadow — and corner brackets that blink.
 */
function markBelgium(ink: Uint8Array, size: number, rotation: number, seconds: number) {
  const be = projectDot(BELGIUM, rotation);
  if (be.z <= 0.2) return;
  const radius = size * GLOBE_RADIUS;
  const bx = Math.round(size / 2 + be.x * radius);
  const by = Math.round(size / 2 - be.y * radius);
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const ring = Math.abs(dx) === 2 || Math.abs(dy) === 2;
      setInk(ink, size, bx + dx, by + dy, ring || (dx === 0 && dy === 0) ? 1 : 0);
    }
  }
  if (Math.floor(seconds * 2) % 2 !== 0) return;
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    for (let k = 0; k < 3; k += 1) {
      setInk(ink, size, bx + sx * 6 - sx * k, by + sy * 6);
      setInk(ink, size, bx + sx * 6, by + sy * 6 - sy * k);
    }
  }
}

/** The desk's globe, `seconds` into its turn: a 1-bit screen, Belgium marked. */
export function renderDitheredGlobe(size: number, seconds: number): Uint8Array {
  const ink = ditherInk(shadeGlobe(size, seconds), size, size);
  markBelgium(ink, size, globeRotation(seconds), seconds);
  return ink;
}
