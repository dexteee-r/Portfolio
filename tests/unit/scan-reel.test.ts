import { describe, expect, it } from "vitest";
import {
  boxInFrame,
  coverCrop,
  CYCLE_MS,
  FRAME_ASPECT,
  lockedAt,
  phaseAt,
  SWEEP_MS,
  SWEEP_START_MS,
  XRAY_FADE_MS,
} from "@/lib/scan-reel";

describe("the reel's clock", () => {
  it("shows a repair every 2.5 seconds, and fits a whole scan in it", () => {
    expect(CYCLE_MS).toBe(2500);
    expect(SWEEP_START_MS + SWEEP_MS + XRAY_FADE_MS).toBeLessThan(CYCLE_MS);
  });

  it("waits for the photo, sweeps the line down, then lets the X-ray fade", () => {
    expect(phaseAt(0)).toEqual({ line: -1, keep: 0 });
    expect(phaseAt(SWEEP_START_MS)).toEqual({ line: 0, keep: 1 });
    expect(phaseAt(SWEEP_START_MS + SWEEP_MS / 2)).toEqual({ line: 0.5, keep: 1 });
    expect(phaseAt(SWEEP_START_MS + SWEEP_MS)).toEqual({ line: 1, keep: 1 });
    expect(phaseAt(SWEEP_START_MS + SWEEP_MS + XRAY_FADE_MS / 2)).toEqual({ line: 1, keep: 0.5 });
    expect(phaseAt(CYCLE_MS - 1)).toEqual({ line: -1, keep: 0 });
  });

  it("locks a box as the line reaches its top, and not before", () => {
    expect(lockedAt(SWEEP_START_MS + SWEEP_MS * 0.4, 0.5)).toBe(false);
    expect(lockedAt(SWEEP_START_MS + SWEEP_MS * 0.5, 0.5)).toBe(true);
    expect(lockedAt(SWEEP_START_MS, 0)).toBe(true);
    expect(lockedAt(0, 0)).toBe(false);
  });
});

describe("the frame: every photo in the same portrait 3:4", () => {
  it("shows a photo of its own proportions whole", () => {
    expect(coverCrop(1536, 2048)).toEqual({ scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 });
  });

  it("crops a wider photo's sides, a taller one's top and bottom — always centred", () => {
    const wide = coverCrop(1420, 1280);
    expect(wide.scaleY).toBe(1);
    expect(wide.scaleX).toBeCloseTo(FRAME_ASPECT / (1420 / 1280), 10);
    expect(wide.offsetX).toBeCloseTo((1 - wide.scaleX) / 2, 10);
    const tall = coverCrop(1242, 2208);
    expect(tall.scaleX).toBe(1);
    expect(tall.offsetY).toBeCloseTo((1 - tall.scaleY) / 2, 10);
  });

  it("moves a part's box with the crop, so it still lands on the part", () => {
    // A photo twice as wide as the frame shows only its middle half.
    const crop = coverCrop(3, 2, 0.75);
    expect(crop.scaleX).toBeCloseTo(0.5, 10);
    const box = boxInFrame({ x: 30, y: 10, w: 20, h: 50 }, crop)!;
    expect(box.x).toBeCloseTo(10, 10);
    expect(box.y).toBeCloseTo(10, 10);
    expect(box.w).toBeCloseTo(40, 10);
    expect(box.h).toBeCloseTo(50, 10);
  });

  it("clips a box half out of the frame, and drops one wholly out of it", () => {
    const crop = coverCrop(3, 2, 0.75);
    const clipped = boxInFrame({ x: 20, y: 0, w: 20, h: 10 }, crop)!;
    expect(clipped.x).toBe(0);
    expect(clipped.w).toBeCloseTo(30, 10);
    expect(boxInFrame({ x: 0, y: 0, w: 20, h: 10 }, crop)).toBeNull();
  });
});
