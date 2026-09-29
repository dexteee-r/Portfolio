import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globals = readFileSync(join(__dirname, "..", "..", "src", "app", "globals.css"), "utf8");
const theme = /@theme inline\s*\{([\s\S]*?)\n\}/.exec(globals)?.[1] ?? "";

/** The reduced-motion block that mentions `selector`, wherever it sits in the file. */
const reducedMotionFor = (selector: string) =>
  globals
    .split("@media (prefers-reduced-motion: reduce)")
    .slice(1)
    .map((block) => block.slice(0, block.search(/\n\}/) + 2))
    .find((block) => block.includes(selector)) ?? "";

describe("globals.css", () => {
  it("imports tokens.css unlayered, so tokens win over Tailwind's layered defaults", () => {
    const line = globals.split("\n").find((l) => l.includes("tokens.css") && l.startsWith("@import"));
    expect(line).toBe('@import "../styles/tokens.css";');
  });

  it("imports tokens after Tailwind", () => {
    expect(globals.indexOf('@import "tailwindcss"')).toBeLessThan(globals.indexOf("tokens.css"));
  });

  it("wipes Tailwind's default palette and every other default scale", () => {
    for (const ns of ["color", "font", "text", "font-weight", "leading", "tracking", "radius", "shadow", "ease"]) {
      expect(theme, ns).toContain(`--${ns}-*: initial;`);
    }
  });

  it("exposes colours only through chapter aliases and marks", () => {
    const colours = [...theme.matchAll(/--color-([\w-]+):\s*([^;]+);/g)]
      .filter((m) => m[1] !== "*")
      .map((m) => [m[1]!, m[2]!.trim()] as const);
    for (const [name, value] of colours) {
      const allowed =
        /^chapter-/.test(name) ||
        /^mark-/.test(name) ||
        ["transparent", "current"].includes(name);
      expect(allowed, name).toBe(true);
      if (name.startsWith("chapter-")) expect(value).toBe(`var(--${name})`);
    }
  });

  it("shows the light frame above a chapter pulled down — beating the chapter's own ground", () => {
    const rule = /:root\[data-pulling\],\s*:root\[data-pulling\] body\s*\{\s*background-color:\s*var\(--color-ground\);\s*\}/;
    expect(globals).toMatch(rule);
    // Unlayered, like the grounds it overrides in tokens.css: after the last layer closes.
    const lastLayer = globals.lastIndexOf("@layer");
    expect(globals.search(rule)).toBeGreaterThan(globals.indexOf("\n}", lastLayer));
  });

  it("keeps the browser's pull-to-refresh out of a chapter, where pulling down closes it", () => {
    expect(globals).toMatch(/html:has\(\[data-view="chapter"\]\)\s*\{\s*overscroll-behavior-y:\s*none;\s*\}/);
  });

  it("draws the network map by default: it only hides once armed by the script, until seen", () => {
    expect(globals).toMatch(/\[data-network\]\[data-armed\]:not\(\[data-drawn\]\) \.net-line\s*\{\s*stroke-dashoffset: 1;/);
    expect(globals).not.toMatch(/\[data-network\] \.net-line\s*\{[^}]*stroke-dashoffset: 1/);
  });

  it("paces the network map with the shared durations, and stills it under reduced motion", () => {
    expect(globals).toMatch(/net-draw var\(--duration-slow\) var\(--ease-standard\)/);
    expect(reducedMotionFor("[data-network]")).toMatch(/\[data-network\] \.net-brackets[\s\S]*animation: none !important/);
  });

  it("rests the floppy's shutter open: it only slides from closed when animations run", () => {
    expect(globals).toMatch(/\[data-floppy\] \.floppy-shutter\s*\{\s*transform: translateX\(14px\);/);
    expect(globals).toMatch(/@keyframes floppy-read\s*\{\s*from\s*\{\s*transform: translateX\(0\);\s*\}\s*\}/);
  });

  it("paces the floppy with the shared durations, and stills it under reduced motion", () => {
    expect(globals).toMatch(/floppy-read var\(--duration-slow\) var\(--ease-standard\) var\(--duration-slow\) both/);
    expect(reducedMotionFor("[data-floppy]")).toMatch(/\[data-floppy\] \.floppy-shutter\s*\{\s*animation: none !important/);
  });

  it("keeps Tailwind's 4px spacing base, the same as tokens.css", () => {
    expect(theme).toMatch(/--spacing:\s*0\.25rem;/);
    expect(theme).not.toMatch(/--spacing-\d+:/);
  });
});
