/**
 * From grey to ink: a 1-bit ordered dither — the screen of an old Mac, a
 * newspaper's halftone — turns a greyscale picture into the frame's single
 * ink. Luma runs from 0 (black, full ink) to 1 (white, bare paper).
 */

/** The classic 8×8 Bayer matrix: thresholds 0–63, spread so no pattern clumps. */
export const BAYER_8: readonly number[] = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];

/** The threshold at a pixel, strictly between 0 and 1. */
export function bayerThreshold(x: number, y: number): number {
  return (BAYER_8[(y % 8) * 8 + (x % 8)]! + 0.5) / 64;
}

/** 1 where the pixel takes ink, 0 where the paper shows. */
export function ditherInk(luma: ArrayLike<number>, width: number, height: number): Uint8Array {
  const ink = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      ink[i] = luma[i]! < bayerThreshold(x, y) ? 1 : 0;
    }
  }
  return ink;
}
