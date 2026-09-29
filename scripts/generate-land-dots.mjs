// Generates src/lib/desk-art/land-dots.json for the dotted globe: points
// spread evenly over the sphere (a Fibonacci lattice), kept where there is
// land — Natural Earth 1:110m (public domain), via world-atlas.
//
// Run once, commit the result: node scripts/generate-land-dots.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const topology = JSON.parse(readFileSync(require.resolve("world-atlas/land-110m.json"), "utf8"));
const land = feature(topology, topology.objects.land);

/** Points on the whole sphere; about 3 in 10 land on land. */
const LATTICE = 7000;
const golden = Math.PI * (3 - Math.sqrt(5));
const degrees = (radians) => (radians * 180) / Math.PI;
const round = (value) => Math.round(value * 10) / 10;

const dots = [];
for (let i = 0; i < LATTICE; i += 1) {
  const y = 1 - (i / (LATTICE - 1)) * 2;
  const lat = degrees(Math.asin(y));
  const lon = ((((degrees(golden * i) % 360) + 540) % 360) - 180);
  if (geoContains(land, [lon, lat])) dots.push([round(lat), round(lon)]);
}

const out = path.join(root, "src", "lib", "desk-art", "land-dots.json");
writeFileSync(
  out,
  `${JSON.stringify({ source: "Natural Earth 1:110m land (public domain), via world-atlas", lattice: LATTICE, dots })}\n`,
);
console.log(`${dots.length} land dots of ${LATTICE} → ${path.relative(root, out)}`);
