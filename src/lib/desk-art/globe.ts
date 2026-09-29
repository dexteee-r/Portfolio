import land from "./land-dots.json";

/**
 * The Earth, turning: Natural Earth's land sampled on an even lattice
 * (scripts/generate-land-dots.mjs), seen from above the equator, with
 * Belgium marked where it comes round. Shaded and screened in pixels.ts.
 */

export type LatLon = readonly [number, number];

export const LAND_DOTS: readonly LatLon[] = land.dots as unknown as LatLon[];

/** Where the site is written from — the top bar says so too. */
export const BELGIUM: LatLon = [50.6, 4.6];

/** Seconds for one full turn. */
export const TURN_PERIOD = 40;
/** The globe leans towards the viewer: northern Europe reads better. */
export const TILT = 0.38;

export interface Projected {
  /** −1 – 1, right is positive. */
  x: number;
  /** −1 – 1, up is positive. */
  y: number;
  /** Positive on the visible half. */
  z: number;
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const degrees = (value: number) => (value * 180) / Math.PI;

/** A point on the unit sphere, turned by `rotation` (radians, eastward) and tilted. */
export function projectDot([lat, lon]: LatLon, rotation: number, tilt: number = TILT): Projected {
  const phi = radians(lat);
  const lambda = radians(lon) + rotation;
  const x = Math.cos(phi) * Math.sin(lambda);
  const y = Math.sin(phi);
  const z = Math.cos(phi) * Math.cos(lambda);
  return { x, y: y * Math.cos(tilt) - z * Math.sin(tilt), z: y * Math.sin(tilt) + z * Math.cos(tilt) };
}

/** The inverse: which latitude and longitude a visible point of the disc shows. */
export function unprojectPoint({ x, y, z }: Projected, rotation: number, tilt: number = TILT): LatLon {
  const upright = y * Math.cos(tilt) + z * Math.sin(tilt);
  const depth = -y * Math.sin(tilt) + z * Math.cos(tilt);
  const lat = degrees(Math.asin(Math.max(-1, Math.min(1, upright))));
  const lon = degrees(Math.atan2(x, depth) - rotation);
  return [lat, ((((lon + 180) % 360) + 360) % 360) - 180];
}

/** The rotation at a moment: starts with Belgium facing the viewer. */
export function globeRotation(seconds: number): number {
  return -radians(BELGIUM[1]) + (seconds / TURN_PERIOD) * Math.PI * 2;
}

/**
 * Land as a one-degree grid, filled around each lattice dot: enough to shade
 * the sphere pixel by pixel. Built once, from the sampled dots.
 */
const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;
const REACH = 2; // degrees around each dot: the lattice is about 2.4° apart

const landGrid: Uint8Array = (() => {
  const grid = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
  for (const [lat, lon] of LAND_DOTS) {
    const reachLon = REACH / Math.max(0.2, Math.cos(radians(lat)));
    for (let dLat = -REACH; dLat <= REACH; dLat += 1) {
      for (let dLon = -Math.ceil(reachLon); dLon <= Math.ceil(reachLon); dLon += 1) {
        if ((dLat / REACH) ** 2 + (dLon / reachLon) ** 2 > 1) continue;
        const row = Math.floor(lat + dLat + 90);
        if (row < 0 || row >= GRID_HEIGHT) continue;
        const column = (((Math.floor(lon + dLon + 180) % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH);
        grid[row * GRID_WIDTH + column] = 1;
      }
    }
  }
  return grid;
})();

export function isLand(lat: number, lon: number): boolean {
  const row = Math.min(GRID_HEIGHT - 1, Math.max(0, Math.floor(lat + 90)));
  const column = (((Math.floor(lon + 180) % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH);
  return landGrid[row * GRID_WIDTH + column] === 1;
}
