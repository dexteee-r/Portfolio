import { readFileSync } from "node:fs";
import path from "node:path";
import type { ChapterId } from "@/content/chapters";

/**
 * Colour values for places CSS variables cannot reach — share cards drawn by
 * Satori, icons, the manifest, <meta name="theme-color">. Read straight from
 * tokens.css at build time, so the stylesheet stays the single source: no
 * colour is ever copied into code.
 */

const HEX = /^#[0-9a-f]{6}$/i;
let cache: Map<string, string> | null = null;

/** Every custom property of the first :root block of a tokens stylesheet. */
export function parseTokens(css: string): Map<string, string> {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const body = /:root\s*\{([^}]*)\}/.exec(source)?.[1] ?? "";
  const tokens = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens.set(match[1]!, match[2]!.trim());
  return tokens;
}

function tokens(): Map<string, string> {
  cache ??= parseTokens(readFileSync(path.join(process.cwd(), "src", "styles", "tokens.css"), "utf8"));
  return cache;
}

/** A colour token's hex value. Throws if it is missing or not a plain hex colour. */
export function tokenColor(name: string, source: Map<string, string> = tokens()): string {
  const value = source.get(name);
  if (!value) throw new Error(`tokens.css has no ${name}`);
  if (!HEX.test(value)) throw new Error(`${name} is "${value}", not a #rrggbb colour`);
  return value;
}

export interface Palette {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  line: string;
}

/** The light frame: the desk. Its accent is ink — the frame has no colour of its own. */
export function framePalette(source?: Map<string, string>): Palette {
  const ink = tokenColor("--color-ink", source);
  return {
    bg: tokenColor("--color-ground", source),
    surface: tokenColor("--color-surface", source),
    ink,
    muted: tokenColor("--color-ink-muted", source),
    accent: ink,
    line: tokenColor("--color-line", source),
  };
}

/** A chapter's own grade. */
export function chapterPalette(chapter: ChapterId, source?: Map<string, string>): Palette {
  return {
    bg: tokenColor(`--${chapter}-bg`, source),
    surface: tokenColor(`--${chapter}-surface`, source),
    ink: tokenColor(`--${chapter}-ink`, source),
    muted: tokenColor(`--${chapter}-muted`, source),
    accent: tokenColor(`--${chapter}-accent`, source),
    line: tokenColor(`--${chapter}-line`, source),
  };
}

/** A chapter's mark: its colour on the light frame. */
export function markColor(chapter: ChapterId, source?: Map<string, string>): string {
  return tokenColor(`--mark-${chapter}`, source);
}
