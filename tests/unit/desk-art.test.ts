import { describe, expect, it } from "vitest";
import { BAYER_8, bayerThreshold, ditherInk } from "@/lib/desk-art/raster";

const count = (mask: ArrayLike<number | boolean>) => Array.from(mask).filter(Boolean).length;

describe("from grey to ink", () => {
  it("uses every Bayer threshold once, strictly between bare paper and full ink", () => {
    expect([...BAYER_8].sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i));
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        expect(bayerThreshold(x, y)).toBeGreaterThan(0);
        expect(bayerThreshold(x, y)).toBeLessThan(1);
      }
    }
  });

  it("leaves white paper bare, covers black in ink, and screens a grey in proportion", () => {
    const size = 16;
    expect(count(ditherInk(new Float32Array(size * size).fill(1), size, size))).toBe(0);
    expect(count(ditherInk(new Float32Array(size * size).fill(0), size, size))).toBe(size * size);
    expect(count(ditherInk(new Float32Array(size * size).fill(0.5), size, size))).toBe((size * size) / 2);
    expect(count(ditherInk(new Float32Array(size * size).fill(0.75), size, size))).toBe((size * size) / 4);
  });
});
