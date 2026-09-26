import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The two families of the site, for images drawn by Satori (share cards).
 * Satori reads TTF, OTF and WOFF — not the WOFF2 next/font serves to browsers
 * — so these come from the Fontsource packages (SIL Open Font License),
 * latin subset. Read once, at build time.
 */

type Weight = 400 | 500 | 600;

interface CardFont {
  name: string;
  data: Buffer;
  weight: Weight;
  style: "normal";
}

const FILES: Array<{ name: string; weight: Weight; file: string }> = [
  { name: "Schibsted Grotesk", weight: 400, file: "schibsted-grotesk/files/schibsted-grotesk-latin-400-normal.woff" },
  { name: "Schibsted Grotesk", weight: 600, file: "schibsted-grotesk/files/schibsted-grotesk-latin-600-normal.woff" },
  { name: "DM Mono", weight: 400, file: "dm-mono/files/dm-mono-latin-400-normal.woff" },
  { name: "DM Mono", weight: 500, file: "dm-mono/files/dm-mono-latin-500-normal.woff" },
];

let cache: CardFont[] | null = null;

export function cardFonts(): CardFont[] {
  cache ??= FILES.map(({ name, weight, file }) => ({
    name,
    weight,
    style: "normal" as const,
    data: readFileSync(path.join(process.cwd(), "node_modules", "@fontsource", file)),
  }));
  return cache;
}
