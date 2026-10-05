import { describe, expect, it } from "vitest";
import { bodyWidth, inPatch, KOI, KOI_LAP, koiSpine, POND_RADIUS, renderDitheredKoi, shadeKoi } from "@/lib/desk-art/koi";

const size = 128;
const count = (mask: ArrayLike<number>) => Array.from(mask).filter(Boolean).length;
const outside = (x: number, y: number) => Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) > size * POND_RADIUS;

describe("the desk's koi", () => {
  it("are two, a light one and a dark one, on opposite sides of the pond", () => {
    expect(KOI.map((koi) => koi.skin)).toEqual(["light", "dark"]);
    const [a, b] = KOI.map((koi) => koiSpine(size, koi, 0, 0.3));
    expect(Math.hypot(a![0] - b![0], a![1] - b![1])).toBeGreaterThan(size * 0.4);
  });

  it("have a round head and a long taper to the tail", () => {
    expect(bodyWidth(-0.1)).toBe(0);
    expect(bodyWidth(0)).toBeGreaterThan(0.4);
    expect(bodyWidth(0.3)).toBeCloseTo(1, 6);
    expect(bodyWidth(0.6)).toBeLessThan(bodyWidth(0.3));
    expect(bodyWidth(0.89)).toBeGreaterThan(bodyWidth(0.95) - 1e-6);
  });

  it("stay in the pond the whole lap: bare paper outside the globe's footprint", () => {
    for (let t = 0; t < KOI_LAP; t += 2.5) {
      const grey = shadeKoi(size, t);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) if (outside(x, y)) expect(grey[y * size + x]).toBe(1);
      }
    }
  });

  it("show their skins: the dark koi's back is dark, the light koi's white skin light", () => {
    const grey = shadeKoi(size, 4);
    const at = ([x, y]: readonly [number, number]) => grey[Math.floor(y) * size + Math.floor(x)]!;
    const [light, dark] = KOI;
    const white = [0.2, 0.25, 0.3, 0.5, 0.75].find((s) => !inPatch(light!.patches, s, 0))!;
    expect(at(koiSpine(size, dark!, 4, 0.3))).toBeLessThan(0.3);
    expect(at(koiSpine(size, light!, 4, white))).toBeGreaterThan(0.5);
  });

  it("swim: two moments draw two pictures, the same moment the same picture", () => {
    expect(renderDitheredKoi(size, 3)).toEqual(renderDitheredKoi(size, 3));
    expect(renderDitheredKoi(size, 3)).not.toEqual(renderDitheredKoi(size, 3.2));
    const [x0, y0] = koiSpine(size, KOI[0]!, 0, 0);
    const [x1, y1] = koiSpine(size, KOI[0]!, KOI_LAP / 4, 0);
    expect(Math.hypot(x1 - x0, y1 - y0)).toBeGreaterThan(size * 0.25);
  });

  it("stay a picture, not a block: a fair share of ink, most of the pond bare", () => {
    for (const t of [0, 9, 18, 27]) {
      const ink = count(renderDitheredKoi(size, t));
      const pond = Math.PI * (size * POND_RADIUS) ** 2;
      expect(ink).toBeGreaterThan(pond * 0.08);
      expect(ink).toBeLessThan(pond * 0.45);
    }
  });
});
