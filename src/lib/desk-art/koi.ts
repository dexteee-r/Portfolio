import { ditherInk } from "./raster";

/**
 * Two koi circling a pond, seen from above — the desk's picture (it replaced
 * a turning globe on 2026-10-05), drawn in a tiny software renderer: greys
 * (0 ink – 1 paper), then the 1-bit screen of raster.ts, never a colour. A
 * light koi and a dark one chase
 * each other round, the old yin-yang pairing, each drawn in outline; their
 * shadows fall on the pond's floor and rings spread where a drop fell. The
 * component paints the mask in the frame's ink.
 */

/** Seconds for one lap of the pond. */
export const KOI_LAP = 36;
/** Nothing is drawn further than this share of the picture's width from its centre. */
export const POND_RADIUS = 0.46;
/** The circle the koi swim round, as a share of the picture's width. */
const PATH_RADIUS = 0.27;
/** A koi's body, nose to the root of its tail, as a share of the picture's width. */
const BODY_LENGTH = 0.42;
/** Half the body at its widest, as a share of the picture's width. */
const BODY_WIDTH = 0.07;
/** How far the body swings from side to side, as a share of its length. */
const SWAY = 0.045;
/** Tail beats a second. */
const BEAT_HZ = 0.9;
const TAU = Math.PI * 2;

/** Along the body, from the nose (0) to the root of the tail (`TAIL_START`) and its tip. */
const NOSE = -0.06;
const TAIL_START = 0.9;
const FORK = 1.12;
const TAIL_END = 1.38;

/** A patch of colour on the skin, in body coordinates: `s` along it, `u` across it (−1 – 1). */
interface Patch {
  s: number;
  u: number;
  rs: number;
  ru: number;
}

export interface Koi {
  /** Where on the circle it starts, in radians. */
  phase: number;
  /** Its own rhythm, so the two never beat together. */
  beat: number;
  /** A light koi with dark patches, or a dark one with light patches. */
  skin: "light" | "dark";
  patches: readonly Patch[];
}

export const KOI: readonly Koi[] = [
  {
    phase: 0,
    beat: 0,
    skin: "light",
    patches: [
      { s: 0.1, u: 0, rs: 0.09, ru: 0.8 },
      { s: 0.4, u: 0.25, rs: 0.14, ru: 1 },
      { s: 0.63, u: -0.2, rs: 0.12, ru: 0.9 },
      { s: 0.81, u: 0.3, rs: 0.06, ru: 0.8 },
    ],
  },
  {
    phase: Math.PI,
    beat: 1.9,
    skin: "dark",
    patches: [],
  },
];

/** Light from the top left, in front — a studio light. */
const LIGHT = (() => {
  const [x, y, z] = [-0.5, 0.55, 0.67];
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length] as const;
})();

const frac = (value: number) => ((value % 1) + 1) % 1;

/**
 * A point of a koi's spine, in pixels, `s` along its body: the koi follows a
 * slightly wandering circle, its body swinging in a wave that runs to the tail.
 */
export function koiSpine(size: number, koi: Koi, seconds: number, s: number): readonly [number, number] {
  const pathRadius = size * PATH_RADIUS;
  const length = size * BODY_LENGTH;
  const phi = koi.phase + (seconds / KOI_LAP) * TAU - (s * length) / pathRadius;
  const wander = pathRadius * (1 + 0.07 * Math.sin(3 * phi + 0.8));
  const sway = length * SWAY * (0.2 + 0.8 * s * s) * Math.sin(TAU * (1.1 * s - BEAT_HZ * seconds) + koi.beat);
  const radius = wander + sway;
  return [size / 2 + radius * Math.cos(phi), size / 2 - radius * Math.sin(phi)];
}

/** Half the body's width at `s`, as a share of its widest: a round head, a long taper. */
export function bodyWidth(s: number): number {
  if (s <= NOSE) return 0;
  if (s < 0.3) return Math.sqrt(Math.max(0, 1 - ((0.3 - s) / 0.36) ** 2));
  if (s < TAIL_START) return 1 - 0.8 * ((s - 0.3) / 0.6) ** 1.3;
  return 0.2;
}

/** Half the tail's width at `s`: a fan opening from the root. */
function tailWidth(s: number): number {
  return 0.2 + 1.5 * ((s - TAIL_START) / (TAIL_END - TAIL_START)) ** 0.7;
}

export function inPatch(patches: readonly Patch[], s: number, u: number): boolean {
  const wobble = 0.15 * Math.sin(23 * s + 7 * u);
  return patches.some((p) => 1 - ((s - p.s) / p.rs) ** 2 - ((u - p.u) / p.ru) ** 2 + wobble > 0);
}

/** What covers each pixel: which koi (−1 none), where on it, and which way its body faces. */
interface Cover {
  koi: Int8Array;
  part: Uint8Array; // 1 body, 2 tail, 3 side fin
  s: Float32Array;
  u: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  best: Float32Array;
}

const BODY = 1;
const TAIL = 2;
const FIN = 3;

function emptyCover(size: number): Cover {
  const n = size * size;
  return {
    koi: new Int8Array(n).fill(-1),
    part: new Uint8Array(n),
    s: new Float32Array(n),
    u: new Float32Array(n),
    nx: new Float32Array(n),
    ny: new Float32Array(n),
    best: new Float32Array(n).fill(Number.POSITIVE_INFINITY),
  };
}

const SAMPLES = 140;

/** The spine's frame at sample `i`: where it is, which way it runs (nose to tail), how far apart samples are. */
function spineFrame(points: readonly (readonly [number, number])[], i: number) {
  const before = points[Math.max(0, i - 1)]!;
  const after = points[Math.min(points.length - 1, i + 1)]!;
  const span = Math.min(points.length - 1, i + 1) - Math.max(0, i - 1);
  const dx = after[0] - before[0];
  const dy = after[1] - before[1];
  const length = Math.hypot(dx, dy) || 1;
  const tx = dx / length;
  const ty = dy / length;
  return { point: points[i]!, tx, ty, nx: -ty, ny: tx, step: length / span };
}

/** The body and tail, laid down slice by slice along the spine. */
function stampKoi(cover: Cover, size: number, index: number, koi: Koi, seconds: number) {
  const widest = size * BODY_WIDTH;
  const points = Array.from({ length: SAMPLES + 1 }, (_, i) =>
    koiSpine(size, koi, seconds, NOSE + ((TAIL_END - NOSE) * i) / SAMPLES),
  );
  for (let i = 0; i <= SAMPLES; i += 1) {
    const s = NOSE + ((TAIL_END - NOSE) * i) / SAMPLES;
    const tail = s >= TAIL_START;
    const reach = (tail ? tailWidth(s) : bodyWidth(s)) * widest;
    if (reach <= 0) continue;
    const { point, tx, ty, nx, ny, step } = spineFrame(points, i);
    const half = step * 0.9;
    const box = Math.ceil(Math.max(reach, half)) + 1;
    for (let y = Math.floor(point[1]) - box; y <= Math.floor(point[1]) + box; y += 1) {
      if (y < 0 || y >= size) continue;
      for (let x = Math.floor(point[0]) - box; x <= Math.floor(point[0]) + box; x += 1) {
        if (x < 0 || x >= size) continue;
        const dx = x + 0.5 - point[0];
        const dy = y + 0.5 - point[1];
        const along = dx * tx + dy * ty;
        const across = dx * nx + dy * ny;
        if (Math.abs(along) > half || Math.abs(across) > reach) continue;
        const u = across / reach;
        // The tail's fork: a notch opening towards the tip.
        if (s > FORK && Math.abs(u) < (0.8 * (s - FORK)) / (TAIL_END - FORK)) continue;
        const at = y * size + x;
        if (Math.abs(along) >= cover.best[at]!) continue;
        cover.best[at] = Math.abs(along);
        cover.koi[at] = index;
        cover.part[at] = tail ? TAIL : BODY;
        cover.s[at] = s;
        cover.u[at] = u;
        cover.nx[at] = nx;
        cover.ny[at] = ny;
      }
    }
  }
}

/** The two side fins behind the head, rowing slowly. Laid down first: the body covers their roots. */
function stampFins(cover: Cover, size: number, index: number, koi: Koi, seconds: number) {
  const s = 0.24;
  const points = [s - 0.02, s, s + 0.02].map((at) => koiSpine(size, koi, seconds, at));
  const { point, tx, ty, nx, ny } = spineFrame(points, 1);
  const length = size * BODY_LENGTH;
  const a = 0.11 * length;
  const b = 0.05 * length;
  const root = bodyWidth(s) * size * BODY_WIDTH * 0.8;
  for (const side of [-1, 1]) {
    const angle = 0.9 + 0.3 * Math.sin(TAU * 0.7 * seconds + koi.beat + side);
    const dx = Math.cos(angle) * -tx + Math.sin(angle) * side * nx;
    const dy = Math.cos(angle) * -ty + Math.sin(angle) * side * ny;
    const cx = point[0] + side * nx * root + dx * a;
    const cy = point[1] + side * ny * root + dy * a;
    const box = Math.ceil(a) + 1;
    for (let y = Math.floor(cy) - box; y <= Math.floor(cy) + box; y += 1) {
      if (y < 0 || y >= size) continue;
      for (let x = Math.floor(cx) - box; x <= Math.floor(cx) + box; x += 1) {
        if (x < 0 || x >= size) continue;
        const px = x + 0.5 - cx;
        const py = y + 0.5 - cy;
        const along = (px * dx + py * dy) / a;
        const across = (px * -dy + py * dx) / b;
        if (along * along + across * across > 1) continue;
        const at = y * size + x;
        if (cover.koi[at]! >= 0) continue;
        cover.koi[at] = index;
        cover.part[at] = FIN;
        cover.s[at] = along;
        cover.u[at] = across;
        cover.best[at] = 99;
      }
    }
  }
}

const RIPPLE_EVERY = 4.5;
const RIPPLE_LIFE = 7;

/** Bare water, and the rings of the drops that fell in the last few seconds. */
function water(size: number, seconds: number): Float32Array {
  const luma = new Float32Array(size * size).fill(1);
  const first = Math.floor((seconds - RIPPLE_LIFE) / RIPPLE_EVERY) + 1;
  const last = Math.floor(seconds / RIPPLE_EVERY);
  for (let k = first; k <= last; k += 1) {
    const age = seconds - k * RIPPLE_EVERY;
    if (age < 0 || age >= RIPPLE_LIFE) continue;
    const angle = k * 2.39996;
    const distance = size * 0.3 * Math.sqrt(frac(k * 0.618034 + 0.3));
    const cx = size / 2 + distance * Math.cos(angle);
    const cy = size / 2 - distance * Math.sin(angle);
    const fade = 1 - age / RIPPLE_LIFE;
    const radius = size * (0.02 + 0.05 * age);
    const box = Math.ceil(radius) + 2;
    for (let y = Math.floor(cy) - box; y <= Math.floor(cy) + box; y += 1) {
      if (y < 0 || y >= size) continue;
      for (let x = Math.floor(cx) - box; x <= Math.floor(cx) + box; x += 1) {
        if (x < 0 || x >= size) continue;
        const off = Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - radius);
        if (off >= 0.8) continue;
        const at = y * size + x;
        luma[at] = Math.min(luma[at]!, 1 - 0.85 * fade * (1 - off / 0.8));
      }
    }
  }
  return luma;
}

/** A koi's skin under the light: round across, patched, a ridge down its back. */
function bodyGrey(koi: Koi, s: number, u: number, nx: number, ny: number): number {
  const z = Math.sqrt(Math.max(0, 1 - u * u));
  // The body's surface leans along its sideways direction (screen y runs down).
  const lit = Math.max(0, u * (nx * LIGHT[0] - ny * LIGHT[1]) + z * LIGHT[2]);
  const patch = inPatch(koi.patches, s, u);
  const light = koi.skin === "light";
  const tone = light ? (patch ? 0.16 : 0.97) : patch ? 0.88 : 0.1;
  let grey = tone * (0.55 + 0.5 * lit);
  if (s > 0.34 && s < 0.66 && Math.abs(u) < 0.14) grey *= 0.6;
  const shine = Math.max(0, 2 * lit * z - LIGHT[2]) ** 30;
  return Math.min(1, grey + 0.45 * shine);
}

/** Fins are thin: a lighter screen than the body, the water showing through. */
function finGrey(koi: Koi, beneath: number): number {
  return 0.3 * beneath + 0.7 * (koi.skin === "light" ? 0.9 : 0.62);
}

/** Whether a pixel of a koi borders something else: each koi is drawn in outline, fins included. */
function onEdge(cover: Cover, size: number, x: number, y: number, index: number): boolean {
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= size || ny >= size || cover.koi[ny * size + nx] !== index) return true;
  }
  return false;
}

/** The pond in greys at a moment: water, rings, the koi's shadows, the koi. */
export function shadeKoi(size: number, seconds: number): Float32Array {
  const luma = water(size, seconds);
  const cover = emptyCover(size);
  KOI.forEach((koi, i) => stampFins(cover, size, i, koi, seconds));
  KOI.forEach((koi, i) => stampKoi(cover, size, i, koi, seconds));

  // Shadows on the floor, down and to the right of what casts them.
  const shiftX = Math.round(size * 0.035);
  const shiftY = Math.round(size * 0.05);
  const shadow = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sx = x + shiftX;
      const sy = y + shiftY;
      if (cover.koi[y * size + x]! >= 0 && sx < size && sy < size) shadow[sy * size + sx] = 1;
    }
  }

  const centre = size / 2;
  const reach = size * POND_RADIUS;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const at = y * size + x;
      if (Math.hypot(x + 0.5 - centre, y + 0.5 - centre) > reach) {
        luma[at] = 1;
        continue;
      }
      const index = cover.koi[at]!;
      const beneath = shadow[at] ? Math.min(luma[at]!, 0.9) : luma[at]!;
      if (index < 0) {
        luma[at] = beneath;
        continue;
      }
      const koi = KOI[index]!;
      if (onEdge(cover, size, x, y, index)) {
        luma[at] = 0;
        continue;
      }
      luma[at] =
        cover.part[at] === BODY
          ? bodyGrey(koi, cover.s[at]!, cover.u[at]!, cover.nx[at]!, cover.ny[at]!)
          : finGrey(koi, beneath);
    }
  }
  return luma;
}

function setInk(ink: Uint8Array, size: number, x: number, y: number, value: number) {
  if (x >= 0 && x < size && y >= 0 && y < size) ink[y * size + x] = value;
}

/** Two eyes each, set after the screen so they never dissolve: ink on the light koi, paper on the dark. */
function markEyes(ink: Uint8Array, size: number, seconds: number) {
  const s = 0.05;
  KOI.forEach((koi) => {
    const points = [s - 0.02, s, s + 0.02].map((at) => koiSpine(size, koi, seconds, at));
    const { point, nx, ny } = spineFrame(points, 1);
    const apart = bodyWidth(s) * size * BODY_WIDTH * 0.55;
    for (const side of [-1, 1]) {
      const x = Math.floor(point[0] + side * nx * apart);
      const y = Math.floor(point[1] + side * ny * apart);
      setInk(ink, size, x, y, koi.skin === "light" ? 1 : 0);
    }
  });
}

/** The desk's koi, `seconds` into their swim: a 1-bit screen. */
export function renderDitheredKoi(size: number, seconds: number): Uint8Array {
  const ink = ditherInk(shadeKoi(size, seconds), size, size);
  markEyes(ink, size, seconds);
  return ink;
}
