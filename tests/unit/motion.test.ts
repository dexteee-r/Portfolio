import { describe, expect, it } from "vitest";
import { HOT_SHARE, LINK_RADIUS, luma, MAX_BLOBS, MOTION_THRESHOLD, trackMotion } from "@/lib/motion";

const W = 64;
const H = 40;

/** A dark frame with bright rectangles, as brightness values. */
function frame(...rects: Array<[x: number, y: number, w: number, h: number]>): Uint8Array {
  const pixels = new Uint8Array(W * H).fill(20);
  for (const [x, y, w, h] of rects) {
    for (let row = y; row < y + h; row += 1) for (let col = x; col < x + w; col += 1) pixels[row * W + col] = 230;
  }
  return pixels;
}

describe("luma", () => {
  it("weighs green most and blue least, like the eye", () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
    const [red, green, blue, white] = luma(rgba);
    expect(green!).toBeGreaterThan(red!);
    expect(red!).toBeGreaterThan(blue!);
    expect(white).toBe(255);
  });
});

describe("trackMotion", () => {
  it("sees nothing in a still picture", () => {
    const still = frame([10, 10, 12, 12]);
    const motion = trackMotion(still, still, W, H, 4);
    expect(motion.cells).toEqual([]);
    expect(motion.blobs).toEqual([]);
  });

  it("ignores flicker below the threshold: compression noise is not motion", () => {
    const before = new Uint8Array(W * H).fill(100);
    const after = new Uint8Array(W * H).fill(100 + MOTION_THRESHOLD);
    expect(trackMotion(before, after, W, H, 4).blobs).toEqual([]);
  });

  it("boxes a moving square as one thing: where it went and where it left, the still middle included", () => {
    const motion = trackMotion(frame([8, 8, 12, 12]), frame([16, 8, 12, 12]), W, H, 4);
    expect(motion.blobs).toHaveLength(1);
    const [blob] = motion.blobs;
    // The change spans x 8–28, y 8–20: the box covers it, on the grid.
    expect(blob!.x).toBeCloseTo(8 / W);
    expect(blob!.y).toBeCloseTo(8 / H);
    expect(blob!.x + blob!.w).toBeGreaterThanOrEqual(28 / W);
    expect(blob!.y + blob!.h).toBeGreaterThanOrEqual(20 / H);
    expect(blob!.share).toBeGreaterThan(0);
    expect(blob!.share).toBeLessThanOrEqual(1);
  });

  it("keeps two things moving apart as two boxes, largest first", () => {
    const motion = trackMotion(frame([4, 4, 8, 8], [44, 24, 12, 12]), frame([8, 4, 8, 8], [52, 24, 12, 12]), W, H, 4);
    expect(motion.blobs).toHaveLength(2);
    expect(motion.blobs[0]!.x).toBeGreaterThan(0.5); // the larger one, on the right
    expect(motion.blobs[0]!.w * motion.blobs[0]!.h).toBeGreaterThanOrEqual(motion.blobs[1]!.w * motion.blobs[1]!.h);
  });

  it("lists the hot cells, each with the share of its pixels that moved", () => {
    const motion = trackMotion(frame(), frame([0, 0, 4, 4]), W, H, 4);
    expect(motion.cells).toEqual([{ col: 0, row: 0, share: 1 }]);
    expect(motion).toMatchObject({ cols: W / 4, rows: H / 4, cellWidth: 4 / W, cellHeight: 4 / H });
  });

  it("needs a real share of a cell to move before calling it hot", () => {
    // One pixel in a 4×4 cell: 1/16, below the bar.
    expect(1 / 16).toBeLessThan(HOT_SHARE);
    expect(trackMotion(frame(), frame([0, 0, 1, 1]), W, H, 4).cells).toEqual([]);
  });

  it("stops at a readable number of boxes, however noisy the frame", () => {
    // Isolated moving cells, each farther than the link radius from the next.
    const step = 4 * (LINK_RADIUS + 1) + 4;
    const rects: Array<[number, number, number, number]> = [];
    for (let y = 0; y < 400; y += step) for (let x = 0; x < 400; x += step) rects.push([x, y, 4, 4]);
    const big = (fill: boolean) => {
      const pixels = new Uint8Array(400 * 400).fill(20);
      if (fill) for (const [x, y] of rects) for (let r = y; r < y + 4; r += 1) for (let c = x; c < x + 4; c += 1) pixels[r * 400 + c] = 230;
      return pixels;
    };
    const motion = trackMotion(big(false), big(true), 400, 400, 4);
    expect(rects.length).toBeGreaterThan(MAX_BLOBS);
    expect(motion.blobs).toHaveLength(MAX_BLOBS);
  });

  it("links hot cells up to the link radius apart, and no farther", () => {
    const gap = (cells: number) =>
      trackMotion(frame(), frame([0, 0, 4, 4], [4 + cells * 4, 0, 4, 4]), W, H, 4).blobs.length;
    expect(gap(LINK_RADIUS - 1)).toBe(1);
    expect(gap(LINK_RADIUS + 1)).toBe(2);
  });

  it("stays inside the frame when the grid does not divide it", () => {
    const motion = trackMotion(frame(), frame([60, 36, 4, 4]), W, H, 7);
    for (const blob of motion.blobs) {
      expect(blob.x + blob.w).toBeLessThanOrEqual(1);
      expect(blob.y + blob.h).toBeLessThanOrEqual(1);
    }
  });
});
