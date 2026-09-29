import { describe, expect, it } from "vitest";
import {
  BELGIUM,
  globeRotation,
  isLand,
  LAND_DOTS,
  projectDot,
  TURN_PERIOD,
  unprojectPoint,
} from "@/lib/desk-art/globe";
import { GLOBE_RADIUS, renderDitheredGlobe, shadeGlobe } from "@/lib/desk-art/pixels";
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

describe("the Earth", () => {
  it("holds the land of Natural Earth, about three dots in ten on the sphere", () => {
    expect(LAND_DOTS.length).toBeGreaterThan(1800);
    expect(LAND_DOTS.length).toBeLessThan(2300);
    for (const [lat, lon] of LAND_DOTS) {
      expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(lon)).toBeLessThanOrEqual(180);
    }
  });

  it("knows land from sea", () => {
    expect(isLand(...BELGIUM)).toBe(true);
    expect(isLand(23, 12)).toBe(true); // the Sahara
    expect(isLand(-25, 134)).toBe(true); // Australia
    expect(isLand(30, -40)).toBe(false); // the middle of the Atlantic
    expect(isLand(0, -150)).toBe(false); // the Pacific
  });

  it("starts with Belgium facing the viewer, and turns it away half a turn later", () => {
    const facing = projectDot(BELGIUM, globeRotation(0));
    expect(facing.z).toBeGreaterThan(0.2);
    expect(Math.abs(facing.x)).toBeLessThan(1e-9);
    expect(projectDot(BELGIUM, globeRotation(TURN_PERIOD / 2)).z).toBeLessThan(0);
  });

  it("keeps every dot on the unit sphere, and finds it again from the screen", () => {
    for (const dot of LAND_DOTS.slice(0, 200)) {
      const p = projectDot(dot, 1.2);
      expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 6);
      const [lat, lon] = unprojectPoint(p, 1.2);
      expect(lat).toBeCloseTo(dot[0], 6);
      expect(Math.abs(((lon - dot[1] + 540) % 360) - 180)).toBeLessThan(1e-6);
    }
  });
});

describe("the dithered 3D globe", () => {
  const size = 128;
  const inside = (x: number, y: number) => Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) <= size * GLOBE_RADIUS;

  it("is a lit sphere on bare paper: nothing outside the disc", () => {
    const grey = shadeGlobe(size, 0);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) if (!inside(x, y)) expect(grey[y * size + x]).toBe(1);
    }
  });

  it("shades land darker than the sea, and the lit side lighter than the shadow side", () => {
    const grey = shadeGlobe(size, 0);
    const at = (x: number, y: number) => grey[Math.round(y) * size + Math.round(x)]!;
    const radius = size * GLOBE_RADIUS;
    const centre = size / 2;
    // Belgium faces the viewer at the start: land at the centre-top, sea further out west.
    const be = projectDot(BELGIUM, globeRotation(0));
    const land = at(centre + be.x * radius, centre - be.y * radius);
    const sea = projectDot([30, -40], globeRotation(0));
    expect(land).toBeLessThan(at(centre + sea.x * radius, centre - sea.y * radius));
    // Same sea, lit (top left) and in shadow (bottom right).
    expect(at(centre - 0.5 * radius, centre - 0.2 * radius)).toBeGreaterThanOrEqual(
      at(centre + 0.6 * radius, centre + 0.5 * radius) - 1e-6,
    );
  });

  it("turns: two moments draw two pictures, the same moment the same picture", () => {
    expect(renderDitheredGlobe(size, 3)).toEqual(renderDitheredGlobe(size, 3));
    expect(renderDitheredGlobe(size, 3)).not.toEqual(renderDitheredGlobe(size, 9));
  });

  it("keeps Belgium readable: a square of paper ringed in ink, whatever lies beneath", () => {
    const ink = renderDitheredGlobe(size, 0.6); // brackets off: only the square
    const be = projectDot(BELGIUM, globeRotation(0.6));
    const bx = Math.round(size / 2 + be.x * size * GLOBE_RADIUS);
    const by = Math.round(size / 2 - be.y * size * GLOBE_RADIUS);
    expect(ink[by * size + bx]).toBe(1); // the dot
    expect(ink[by * size + bx + 1]).toBe(0); // paper around it
    expect(ink[by * size + bx + 2]).toBe(1); // the ring
  });

  it("blinks Belgium's brackets, twice a second", () => {
    const on = renderDitheredGlobe(size, 0);
    const off = renderDitheredGlobe(size, 0.6);
    const be = projectDot(BELGIUM, globeRotation(0));
    const corner = Math.round(size / 2 - be.y * size * GLOBE_RADIUS - 6) * size + Math.round(size / 2 + be.x * size * GLOBE_RADIUS - 6);
    expect(on[corner]).toBe(1);
    expect(count(on)).not.toBe(count(off));
  });

  it("stays a picture, not a block: a fair share of ink, and some paper inside the disc", () => {
    const ink = count(renderDitheredGlobe(size, 10));
    const disc = Math.PI * (size * GLOBE_RADIUS) ** 2;
    expect(ink).toBeGreaterThan(disc * 0.2);
    expect(ink).toBeLessThan(disc * 0.8);
  });
});
